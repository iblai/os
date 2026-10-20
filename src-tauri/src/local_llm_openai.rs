//! The on-device model for the webview's Cowork loop.
//!
//! The page cannot call localhost from the app's https origin (mixed content),
//! so the desktop makes the request to Ollama's OpenAI-compatible endpoint and
//! streams the body back over a channel. The URL is fixed — nothing the page
//! sends can point this elsewhere — and a cancel ends the upstream request, so
//! Stop stops the model and not just the page's interest in it.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use futures_util::StreamExt;
use serde_json::{json, Value};
use tauri::{command, ipc::Channel};
use tokio::task::AbortHandle;

/// In-flight requests by the page's id, so a cancel can abort the one it names.
static IN_FLIGHT: OnceLock<Mutex<HashMap<String, AbortHandle>>> = OnceLock::new();

fn in_flight() -> &'static Mutex<HashMap<String, AbortHandle>> {
    IN_FLIGHT.get_or_init(|| Mutex::new(HashMap::new()))
}

fn chat_completions_url() -> String {
    format!(
        "{}/v1/chat/completions",
        crate::model_manager::OLLAMA_API_URL.trim_end_matches('/')
    )
}

/// Stream one chat completion from the local model to the page. `body` is the
/// request as the AI SDK would have sent it; the events are `head` (status and
/// content type), `chunk` (whole lines of the body) and `end`.
#[command]
pub async fn local_llm_openai_stream(
    request_id: String,
    body: String,
    on_event: Channel<Value>,
) -> Result<(), String> {
    // Start Ollama when it isn't up, as Code does for its on-device sessions.
    if !crate::model_manager::wait_for_ollama_ready(1).await {
        crate::model_manager::start_ollama_server()?;
        if !crate::model_manager::wait_for_ollama_ready(20).await {
            return Err("Ollama isn't running and couldn't be started.".to_string());
        }
    }
    run_stream(request_id, chat_completions_url(), body, on_event).await
}

/// Stop the request the page named (its Stop button).
#[command]
pub async fn local_llm_openai_stream_cancel(request_id: String) -> Result<(), String> {
    let handle = in_flight()
        .lock()
        .map_err(|_| "local model lock poisoned")?
        .remove(&request_id);
    if let Some(handle) = handle {
        handle.abort();
    }
    Ok(())
}

/// The stream as a cancellable task, registered under `request_id` for as long
/// as it runs. A cancelled task ends quietly: the page already dropped the body.
async fn run_stream(
    request_id: String,
    url: String,
    body: String,
    on_event: Channel<Value>,
) -> Result<(), String> {
    let task = tokio::spawn(stream_from(url, body, on_event));
    in_flight()
        .lock()
        .map_err(|_| "local model lock poisoned")?
        .insert(request_id.clone(), task.abort_handle());
    let res = task.await;
    if let Ok(mut map) = in_flight().lock() {
        map.remove(&request_id);
    }
    match res {
        Ok(res) => res,
        Err(_cancelled) => Ok(()),
    }
}

async fn stream_from(url: String, body: String, on_event: Channel<Value>) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| format!("Couldn't reach the local model: {e}"))?;
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach the local model: {e}"))?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let send = |event: Value| {
        on_event
            .send(event)
            .map_err(|e| format!("the page stopped listening: {e}"))
    };
    send(json!({ "kind": "head", "status": status, "content_type": content_type }))?;

    let mut stream = response.bytes_stream();
    let mut pending: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("The local model stopped answering: {e}"))?;
        pending.extend_from_slice(&chunk);
        // Whole lines only: a chunk can split a multibyte character, and the
        // body (an event stream, or one JSON error) is line-shaped anyway.
        if let Some(cut) = pending.iter().rposition(|b| *b == b'\n') {
            let lines: Vec<u8> = pending.drain(..=cut).collect();
            send(json!({ "kind": "chunk", "data": String::from_utf8_lossy(&lines) }))?;
        }
    }
    if !pending.is_empty() {
        send(json!({ "kind": "chunk", "data": String::from_utf8_lossy(&pending) }))?;
    }
    send(json!({ "kind": "end" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use tauri::ipc::InvokeResponseBody;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// A one-request HTTP server: `status` and `body`, the body written in two
    /// halves with a pause between them so the client sees two chunks. With
    /// `stall`, the second half never comes.
    async fn stub(status: &'static str, body: &'static str, stall: bool) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 65536];
            let _ = sock.read(&mut buf).await;
            let head = format!(
                "HTTP/1.1 {status}\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\n\r\n",
                body.len()
            );
            let (first, second) = body.split_at(body.len() / 2);
            sock.write_all(head.as_bytes()).await.unwrap();
            sock.write_all(first.as_bytes()).await.unwrap();
            sock.flush().await.unwrap();
            if stall {
                tokio::time::sleep(Duration::from_secs(30)).await;
            } else {
                tokio::time::sleep(Duration::from_millis(50)).await;
                sock.write_all(second.as_bytes()).await.unwrap();
                sock.flush().await.unwrap();
            }
        });
        format!("http://{addr}/v1/chat/completions")
    }

    /// A channel whose events land on a receiver, as the page would see them.
    fn channel() -> (Channel<Value>, mpsc::Receiver<Value>) {
        let (tx, rx) = mpsc::channel();
        let channel = Channel::new(move |body| {
            if let InvokeResponseBody::Json(text) = body {
                let _ = tx.send(serde_json::from_str(&text).unwrap());
            }
            Ok(())
        });
        (channel, rx)
    }

    #[tokio::test]
    async fn streams_the_upstream_body_as_whole_lines_and_ends() {
        let body = "data: {\"a\":1}\n\ndata: {\"b\":\"é\"}\n\ndata: [DONE]\n\n";
        let url = stub("200 OK", body, false).await;
        let (channel, rx) = channel();
        run_stream("r1".into(), url, "{}".into(), channel)
            .await
            .unwrap();
        let events: Vec<Value> = rx.try_iter().collect();
        assert_eq!(events[0]["kind"], "head");
        assert_eq!(events[0]["status"], 200);
        assert_eq!(events[0]["content_type"], "text/event-stream");
        let data: String = events[1..events.len() - 1]
            .iter()
            .map(|e| {
                assert_eq!(e["kind"], "chunk");
                e["data"].as_str().unwrap().to_string()
            })
            .collect();
        assert_eq!(data, body);
        assert_eq!(events.last().unwrap()["kind"], "end");
        // Own id only: the map is process-global and the other tests stream too.
        assert!(!in_flight().lock().unwrap().contains_key("r1"));
    }

    #[tokio::test]
    async fn an_upstream_error_status_reaches_the_page_as_is() {
        let url = stub(
            "404 Not Found",
            "{\"error\":{\"message\":\"model not found\"}}",
            false,
        )
        .await;
        let (channel, rx) = channel();
        run_stream("r2".into(), url, "{}".into(), channel)
            .await
            .unwrap();
        let events: Vec<Value> = rx.try_iter().collect();
        assert_eq!(events[0]["status"], 404);
        assert!(events[1]["data"]
            .as_str()
            .unwrap()
            .contains("model not found"));
        assert_eq!(events.last().unwrap()["kind"], "end");
    }

    // Multi-threaded: `recv_timeout` blocks its thread, and the stub server
    // and the stream must keep running meanwhile.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn cancel_ends_a_stalled_stream_without_an_end_event() {
        let url = stub("200 OK", "data: {\"a\":1}\n\ndata: never\n\n", true).await;
        let (channel, rx) = channel();
        let task = tokio::spawn(run_stream("r3".into(), url, "{}".into(), channel));
        let head = rx.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_eq!(head["kind"], "head");
        assert!(in_flight().lock().unwrap().contains_key("r3"));
        local_llm_openai_stream_cancel("r3".into()).await.unwrap();
        assert_eq!(task.await.unwrap(), Ok(()));
        let rest: Vec<Value> = rx.try_iter().collect();
        assert!(rest.iter().all(|e| e["kind"] != "end"), "{rest:?}");
        assert!(!in_flight().lock().unwrap().contains_key("r3"));
    }

    #[tokio::test]
    async fn an_unreachable_model_is_a_plain_error() {
        let (channel, _rx) = channel();
        let err = run_stream(
            "r4".into(),
            "http://127.0.0.1:1/v1/chat/completions".into(),
            "{}".into(),
            channel,
        )
        .await
        .unwrap_err();
        assert!(err.starts_with("Couldn't reach the local model"), "{err}");
    }
}
