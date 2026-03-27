import React, { useEffect, useState } from "react";

import { useLazyGetGuidedPromptsQuery } from "@iblai/iblai-js/data-layer";
import { useMentorSettings } from "./use-mentors/use-mentor-settings";

type Props = {
  sessionId: string;
  username: string;
  tenantKey: string;
  mentorUniqueId: string;
  token: string;
  wsUrl: string;
  isNewSession?: boolean;
};

export default function useWelcome({
  sessionId,
  username,
  tenantKey,
  mentorUniqueId,
  token,
  wsUrl,
  isNewSession = true,
}: Props) {
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const webSocket = React.useRef<WebSocket | null>(null);

  const [loadGuidedPrompts] = useLazyGetGuidedPromptsQuery();

  const { data: mentorSettings } = useMentorSettings();

  const greetingMethod = mentorSettings?.greetingMethod;
  const proactiveResponse = mentorSettings?.proactiveResponse;

  const chatPayload = {
    flow: {
      name: mentorUniqueId,
      tenant: tenantKey,
      username: username,
      pathway: mentorUniqueId,
    },
    session_id: sessionId,
    token,
  };

  const _initiateConnection = () => {
    try {
      if (webSocket.current?.readyState === WebSocket.OPEN) {
        webSocket.current.send(JSON.stringify(chatPayload));
      }
    } catch (error) {
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const _handleSendTextQuery = () => {
    const payload = {
      ...chatPayload,
      is_proactive: true,
    };
    if (webSocket.current?.readyState === WebSocket.OPEN) {
      webSocket.current.send(JSON.stringify(payload));
    }
  };

  const _handleIncomingMessage = (event: MessageEvent) => {
    let response = JSON.parse(event.data);

    if (response?.detail === "Connected.") {
      _handleSendTextQuery();
    }

    if (response?.data) {
      setWelcomeMessage((prev) => prev + response?.data);
    }

    if (response?.eos) {
      setTimeout(() => {
        _endConnection();
        loadGuidedPrompts({
          org: tenantKey,
          sessionId,
          // @ts-ignore
          userId: username,
        });
      }, 200);
    }

    if (response?.error) {
      console.log(response.error);
      //toast.custom(Error(response.error));
      _endConnection();
    }
  };

  useEffect(() => {
    if (greetingMethod === "proactive_response") {
      setWelcomeMessage(proactiveResponse ?? "");
    }
  }, [proactiveResponse]);

  const _endConnection = () => {
    if (webSocket.current?.readyState === WebSocket.OPEN) {
      webSocket.current?.close();
    }
  };

  const handleSendProactivePrompt = () => {
    if (greetingMethod === "proactive_prompt") {
      webSocket.current = new WebSocket(wsUrl);

      webSocket.current.onmessage = _handleIncomingMessage;
      webSocket.current.onopen = () => _initiateConnection();
    }
  };

  useEffect(() => {
    _endConnection();
    setWelcomeMessage("");
    if (mentorUniqueId) {
      if (greetingMethod === "proactive_prompt") {
        isNewSession && handleSendProactivePrompt();
      } else if (greetingMethod === "proactive_response") {
        setWelcomeMessage(proactiveResponse ?? "");
      }
    }
    return () => {
      _endConnection();
    };
  }, [
    sessionId,
    tenantKey,
    username,
    mentorUniqueId,
    greetingMethod,
    proactiveResponse,
    isNewSession,
  ]);

  return { welcomeMessage, handleSendProactivePrompt };
}
