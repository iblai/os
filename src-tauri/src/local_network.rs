//! iOS "Local Network" permission — the "find and connect to devices on your
//! local network" prompt that gates every socket the phone opens toward the
//! desktop in Code mode.
//!
//! iOS has no API to ask for that permission or to read it. What it does
//! document is the behaviour: the first packet an app sends toward a local
//! network address raises the prompt, and while the answer is pending or
//! Don't Allow, sends to local addresses fail with `EHOSTUNREACH` ("No
//! route to host"). So the probe IS such a send — one empty UDP datagram to
//! a neighbour on the phone's own Wi-Fi subnet (the `.1` address, normally
//! the router; nothing needs to answer). It goes out → granted; no route →
//! denied (or the prompt is still up, which is why an unanswered first ask
//! keeps trying for a while); no Wi-Fi address at all → no verdict.
//!
//! Telling "the prompt is up" from "Don't Allow" (both refuse the send):
//! a system alert makes the app inactive (`UIApplicationWillResignActive`)
//! and dismissing it makes it active again, so a refusal while the app is
//! active is an answer, and one while it is inactive is a wait.
//!
//! Two users: the app asks at launch (so the first pairing scan is not the
//! first thing to hit the prompt), and the Code panel asks before showing
//! the pairing UI — hiding it behind an "Open Settings" button when access
//! was denied, since no pairing can work until it is turned back on. The
//! switch can be flipped either way in Settings while the app runs, so
//! nothing is cached: every ask is a fresh send.
//!
//! Android has no such permission: everything here reports granted there.

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LocalNetwork {
    /// A packet to the local network went out: sockets to the desktop work.
    Granted,
    /// The user chose Don't Allow (now or earlier). Only Settings can fix it.
    Denied,
    /// No verdict: no Wi-Fi address to test with, or the prompt was never
    /// answered inside the window. Pairing may still be attempted; it
    /// raises the prompt itself.
    Undetermined,
}

/// The last verdict of this process, for logging and tests; never trusted
/// over a fresh send (the Settings switch changes it live, both ways).
static LAST: Mutex<Option<LocalNetwork>> = Mutex::new(None);

/// Where "the prompt has been answered once" persists. iOS asks exactly once
/// per install, so after that one answer a single send tells the truth at
/// once; only the very first ask has to wait for the user.
static STATE_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Wire the persisted state to the app's data directory and start watching
/// the app's active state (mobile setup, main thread).
pub fn init(dir: PathBuf) {
    let _ = std::fs::create_dir_all(&dir);
    let _ = STATE_PATH.set(dir.join("local_network_asked"));
    activity::observe();
}

fn asked() -> bool {
    STATE_PATH.get().is_some_and(|p| p.exists())
}

fn remember_asked() {
    if let Some(p) = STATE_PATH.get() {
        let _ = std::fs::write(p, b"1");
    }
}

/// What one probe send came back with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Attempt {
    /// The datagram left: the local network is reachable.
    Sent,
    /// `EHOSTUNREACH`: the system refused the local network (denied, or
    /// the prompt is up right now).
    NoRoute,
    /// No Wi-Fi/LAN address to aim at.
    NoLan,
    /// Some other socket error (errno), which says nothing about the
    /// permission.
    Other(i32),
}

/// The verdict once the window is over, from the last attempt made.
pub(crate) fn verdict(last: Attempt) -> LocalNetwork {
    match last {
        Attempt::Sent => LocalNetwork::Granted,
        Attempt::NoRoute => LocalNetwork::Denied,
        Attempt::NoLan | Attempt::Other(_) => LocalNetwork::Undetermined,
    }
}

/// How long after a refused send the system alert gets to appear (it makes
/// the app inactive) before the refusal is read as the user's answer.
const ALERT_GRACE: Duration = Duration::from_secs(1);

/// Send until one goes out, the user answers, or the window ends.
///
/// A refusal while the app is inactive is the prompt waiting for the user:
/// keep trying (bounded by `window`). A refusal while the app is active is
/// an answer — at once when the prompt was answered before (`first_ask`
/// false; iOS never asks twice), and on the first ask only after the alert
/// had [`ALERT_GRACE`] to appear and one more send confirmed it (the user
/// may have tapped Allow between a refusal and the active check).
fn probe(
    window: Duration,
    first_ask: bool,
    attempt: impl Fn() -> Attempt,
    active: impl Fn() -> bool,
) -> LocalNetwork {
    let deadline = std::time::Instant::now() + window;
    let mut grace_given = false;
    loop {
        let last = attempt();
        if last != Attempt::NoRoute {
            return verdict(last);
        }
        if !active() {
            // The prompt is on screen: wait for the answer.
            if std::time::Instant::now() >= deadline {
                return LocalNetwork::Denied;
            }
            std::thread::sleep(Duration::from_millis(300));
            continue;
        }
        if first_ask && !grace_given {
            // Give the alert its moment to appear; the next send decides
            // either way (it waits if the app went inactive meanwhile).
            grace_given = true;
            let grace = std::time::Instant::now() + ALERT_GRACE;
            while std::time::Instant::now() < grace && active() {
                std::thread::sleep(Duration::from_millis(50));
            }
            continue;
        }
        // Refused with no alert on screen: that is the user's answer.
        return LocalNetwork::Denied;
    }
}

/// The cached verdict, if any.
pub fn last() -> Option<LocalNetwork> {
    *LAST.lock().expect("local network lock")
}

/// Ask (blocking). `window` bounds how long an unanswered prompt is waited
/// for; an answered one resolves in a single send.
pub fn ensure(window: Duration) -> LocalNetwork {
    let first_ask = !asked();
    let verdict = probe(window, first_ask, lan::attempt, activity::active);
    log(&format!("verdict {verdict:?} (first ask: {first_ask})"));
    if verdict != LocalNetwork::Undetermined {
        remember_asked();
    }
    *LAST.lock().expect("local network lock") = Some(verdict);
    verdict
}

/// Frontend: the permission verdict, asking (and raising the prompt) when
/// it is not yet granted. Waits for a first answer for up to `PANEL_WINDOW`.
#[tauri::command]
pub async fn local_network_status() -> Result<LocalNetwork, String> {
    tokio::task::spawn_blocking(|| ensure(PANEL_WINDOW))
        .await
        .map_err(|e| e.to_string())
}

/// Frontend: open this app's page in the Settings app, where the Local
/// Network switch lives.
#[tauri::command]
pub async fn open_app_settings(app: tauri::AppHandle) -> Result<(), String> {
    settings::open(&app)
}

/// How long the Code panel waits for a first answer before rendering the
/// pairing UI anyway (pairing raises the prompt and retries itself).
const PANEL_WINDOW: Duration = Duration::from_secs(20);
/// The launch-time ask can wait longer: nothing is blocked on it.
pub const LAUNCH_WINDOW: Duration = Duration::from_secs(90);

/// On iOS the app's stdout goes nowhere; NSLog reaches the device log
/// (`idevicesyslog`, Console.app). Elsewhere, plain stdout.
#[cfg(target_os = "ios")]
fn log(msg: &str) {
    use objc::runtime::Object;
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CString;
    extern "C" {
        fn NSLog(format: *mut Object, ...);
    }
    println!("[LocalNetwork] {msg}");
    let (Ok(fmt), Ok(text)) = (CString::new("[LocalNetwork] %s"), CString::new(msg)) else {
        return;
    };
    #[allow(unexpected_cfgs)]
    unsafe {
        let ns_fmt: *mut Object = msg_send![class!(NSString), stringWithUTF8String: fmt.as_ptr()];
        NSLog(ns_fmt, text.as_ptr());
    }
}

#[cfg(not(target_os = "ios"))]
fn log(msg: &str) {
    println!("[LocalNetwork] {msg}");
}

/// Whether the app is active — false while a system alert (the permission
/// prompt) is up, true again once it is answered.
#[cfg(target_os = "ios")]
mod activity {
    use block::ConcreteBlock;
    use objc::runtime::Object;
    use objc::{class, msg_send, sel, sel_impl};
    use std::sync::atomic::{AtomicBool, Ordering};

    static ACTIVE: AtomicBool = AtomicBool::new(true);

    #[link(name = "UIKit", kind = "framework")]
    extern "C" {
        static UIApplicationDidBecomeActiveNotification: *mut Object;
        static UIApplicationWillResignActiveNotification: *mut Object;
    }

    pub(super) fn active() -> bool {
        ACTIVE.load(Ordering::SeqCst)
    }

    /// Register the two observers once, for the life of the process.
    #[allow(unexpected_cfgs)]
    pub(super) fn observe() {
        unsafe {
            let center: *mut Object = msg_send![class!(NSNotificationCenter), defaultCenter];
            let queue: *mut Object = msg_send![class!(NSOperationQueue), mainQueue];
            let became_active = ConcreteBlock::new(|_note: *mut Object| {
                ACTIVE.store(true, Ordering::SeqCst);
            })
            .copy();
            let will_resign = ConcreteBlock::new(|_note: *mut Object| {
                ACTIVE.store(false, Ordering::SeqCst);
            })
            .copy();
            let _: *mut Object = msg_send![
                center,
                addObserverForName: UIApplicationDidBecomeActiveNotification
                object: std::ptr::null::<Object>()
                queue: queue
                usingBlock: &*became_active
            ];
            let _: *mut Object = msg_send![
                center,
                addObserverForName: UIApplicationWillResignActiveNotification
                object: std::ptr::null::<Object>()
                queue: queue
                usingBlock: &*will_resign
            ];
            // The center keeps the blocks; never removed.
            std::mem::forget(became_active);
            std::mem::forget(will_resign);
        }
    }
}

#[cfg(not(target_os = "ios"))]
mod activity {
    /// No system prompt exists elsewhere: always active.
    pub(super) fn active() -> bool {
        true
    }

    pub(super) fn observe() {}
}

/// The socket half. Compiled on iOS (where it matters) and macOS (same
/// APIs, so the host can smoke-test it); everything else answers granted.
#[cfg(any(target_os = "ios", target_os = "macos"))]
mod lan {
    use super::{log, Attempt};
    use std::ffi::CStr;
    use std::net::{Ipv4Addr, SocketAddrV4, UdpSocket};

    /// The Wi-Fi/LAN IPv4 address and netmask: `en0` first (the phone's
    /// Wi-Fi), else the first private address on any other interface.
    fn lan_ipv4() -> Option<(Ipv4Addr, Ipv4Addr)> {
        let mut list: *mut libc::ifaddrs = std::ptr::null_mut();
        // SAFETY: getifaddrs fills `list` with a linked list freed below.
        if unsafe { libc::getifaddrs(&mut list) } != 0 {
            return None;
        }
        let mut en0 = None;
        let mut other = None;
        let mut cur = list;
        while !cur.is_null() {
            // SAFETY: `cur` walks the list getifaddrs returned.
            let ifa = unsafe { &*cur };
            cur = ifa.ifa_next;
            if ifa.ifa_addr.is_null() || ifa.ifa_netmask.is_null() {
                continue;
            }
            // SAFETY: both pointers are non-null sockaddrs of this entry;
            // the family check precedes the sockaddr_in casts.
            let Some((addr, mask)) = (unsafe {
                if i32::from((*ifa.ifa_addr).sa_family) != libc::AF_INET {
                    None
                } else {
                    let a = &*(ifa.ifa_addr as *const libc::sockaddr_in);
                    let m = &*(ifa.ifa_netmask as *const libc::sockaddr_in);
                    Some((
                        Ipv4Addr::from(u32::from_be(a.sin_addr.s_addr)),
                        Ipv4Addr::from(u32::from_be(m.sin_addr.s_addr)),
                    ))
                }
            }) else {
                continue;
            };
            // SAFETY: ifa_name is a NUL-terminated string owned by the list.
            let name = unsafe { CStr::from_ptr(ifa.ifa_name) }.to_string_lossy();
            if addr.is_loopback() || mask == Ipv4Addr::BROADCAST {
                continue;
            }
            if name == "en0" {
                en0 = Some((addr, mask));
            } else if other.is_none() && addr.is_private() {
                other = Some((addr, mask));
            }
        }
        // SAFETY: the list came from getifaddrs and is not used after this.
        unsafe { libc::freeifaddrs(list) };
        en0.or(other)
    }

    /// A neighbour on the LAN to aim the probe at: the subnet's `.1`
    /// (normally the router), or `.2` when `.1` is this device itself.
    pub(super) fn neighbour(addr: Ipv4Addr, mask: Ipv4Addr) -> Ipv4Addr {
        let network = u32::from(addr) & u32::from(mask);
        let first = Ipv4Addr::from(network | 1);
        if first == addr {
            Ipv4Addr::from(network | 2)
        } else {
            first
        }
    }

    /// One probe send. UDP: the send either leaves or is refused right
    /// here — nothing has to be listening on the other end (port 9 is
    /// "discard").
    pub(super) fn attempt() -> Attempt {
        let Some((addr, mask)) = lan_ipv4() else {
            log("no LAN address to probe from");
            return Attempt::NoLan;
        };
        let target = SocketAddrV4::new(neighbour(addr, mask), 9);
        let result = UdpSocket::bind("0.0.0.0:0").and_then(|s| s.send_to(&[0], target));
        match result {
            Ok(_) => Attempt::Sent,
            Err(e) if e.raw_os_error() == Some(libc::EHOSTUNREACH) => {
                log(&format!("send to {target} refused: {e}"));
                Attempt::NoRoute
            }
            Err(e) => {
                log(&format!("send to {target} failed: {e}"));
                Attempt::Other(e.raw_os_error().unwrap_or(0))
            }
        }
    }
}

#[cfg(not(any(target_os = "ios", target_os = "macos")))]
mod lan {
    use super::Attempt;

    pub(super) fn attempt() -> Attempt {
        Attempt::Sent
    }
}

#[cfg(target_os = "ios")]
mod settings {
    use objc::runtime::Object;
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CString;
    use std::ptr;
    use tauri::AppHandle;

    /// `UIApplicationOpenSettingsURLString`: the app's own Settings page.
    const APP_SETTINGS_URL: &str = "app-settings:";

    #[allow(unexpected_cfgs)]
    pub(super) fn open(app: &AppHandle) -> Result<(), String> {
        app.run_on_main_thread(|| unsafe {
            let c_url = CString::new(APP_SETTINGS_URL).expect("static");
            let ns_string: *mut Object =
                msg_send![class!(NSString), stringWithUTF8String: c_url.as_ptr()];
            let ns_url: *mut Object = msg_send![class!(NSURL), URLWithString: ns_string];
            if ns_url.is_null() {
                eprintln!("[LocalNetwork] app-settings: URL did not parse");
                return;
            }
            let shared: *mut Object = msg_send![class!(UIApplication), sharedApplication];
            let _: () = msg_send![
                shared,
                openURL: ns_url
                options: ptr::null::<Object>()
                completionHandler: ptr::null::<Object>()
            ];
        })
        .map_err(|e| e.to_string())
    }
}

#[cfg(not(target_os = "ios"))]
mod settings {
    use tauri::AppHandle;

    /// Nothing to open: no other platform gates the local network.
    pub(super) fn open(_app: &AppHandle) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn the_last_attempt_decides_and_only_a_refusal_is_a_denial() {
        assert_eq!(verdict(Attempt::Sent), LocalNetwork::Granted);
        assert_eq!(verdict(Attempt::NoRoute), LocalNetwork::Denied);
        assert_eq!(verdict(Attempt::NoLan), LocalNetwork::Undetermined);
        assert_eq!(verdict(Attempt::Other(51)), LocalNetwork::Undetermined);
    }

    /// The prompt is up (app inactive): sends are refused until the user
    /// taps Allow. The probe must keep trying inside its window and take
    /// the first send that goes out — not report the refusal it saw first.
    #[test]
    fn a_refusal_while_the_prompt_is_up_is_retried_until_the_send_goes_out() {
        let calls = AtomicUsize::new(0);
        let v = probe(
            Duration::from_secs(10),
            true,
            || {
                if calls.fetch_add(1, Ordering::SeqCst) < 2 {
                    Attempt::NoRoute
                } else {
                    Attempt::Sent
                }
            },
            // Inactive until the second refusal has been seen: the alert
            // is on screen, then the user taps Allow.
            || calls.load(Ordering::SeqCst) >= 2,
        );
        assert_eq!(v, LocalNetwork::Granted);
        assert_eq!(calls.load(Ordering::SeqCst), 3);
    }

    /// Don't Allow on the first ask: the alert is gone (app active again)
    /// and the send is still refused — that is the answer, after the short
    /// grace an alert gets to appear, not after the whole window.
    #[test]
    fn a_refusal_with_the_app_active_is_the_users_answer() {
        let started = std::time::Instant::now();
        let v = probe(Duration::from_secs(60), true, || Attempt::NoRoute, || true);
        assert_eq!(v, LocalNetwork::Denied);
        let took = started.elapsed();
        assert!(took >= ALERT_GRACE, "gave the alert its moment: {took:?}");
        assert!(
            took < Duration::from_secs(5),
            "did not wait out the window: {took:?}"
        );
        // Answered before (asked marker set): no grace at all, one send.
        let calls = AtomicUsize::new(0);
        let started = std::time::Instant::now();
        let v = probe(
            Duration::from_secs(60),
            false,
            || {
                calls.fetch_add(1, Ordering::SeqCst);
                Attempt::NoRoute
            },
            || true,
        );
        assert_eq!(v, LocalNetwork::Denied);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(started.elapsed() < Duration::from_millis(500));
    }

    /// The prompt never gets answered: the window, not forever.
    #[test]
    fn an_unanswered_prompt_ends_at_the_window() {
        let started = std::time::Instant::now();
        let v = probe(
            Duration::from_millis(700),
            true,
            || Attempt::NoRoute,
            || false,
        );
        assert_eq!(v, LocalNetwork::Denied);
        assert!(started.elapsed() >= Duration::from_millis(700));
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[test]
    fn the_verdict_serializes_as_the_frontend_strings() {
        assert_eq!(
            serde_json::to_value(LocalNetwork::Granted).unwrap(),
            "granted"
        );
        assert_eq!(
            serde_json::to_value(LocalNetwork::Denied).unwrap(),
            "denied"
        );
        assert_eq!(
            serde_json::to_value(LocalNetwork::Undetermined).unwrap(),
            "undetermined"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn the_probe_aims_at_a_neighbour_never_at_itself() {
        use std::net::Ipv4Addr;
        let mask = Ipv4Addr::new(255, 255, 255, 0);
        assert_eq!(
            lan::neighbour(Ipv4Addr::new(192, 168, 0, 196), mask),
            Ipv4Addr::new(192, 168, 0, 1)
        );
        assert_eq!(
            lan::neighbour(Ipv4Addr::new(192, 168, 0, 1), mask),
            Ipv4Addr::new(192, 168, 0, 2)
        );
    }

    /// The real send on the host: with a LAN address present the datagram
    /// must leave (macOS does not gate a test binary). Without one there is
    /// nothing to assert.
    #[cfg(target_os = "macos")]
    #[test]
    fn a_probe_send_leaves_on_a_host_with_a_lan_address() {
        match lan::attempt() {
            Attempt::NoLan => eprintln!("no LAN address here; skipped"),
            other => assert_eq!(other, Attempt::Sent),
        }
    }
}
