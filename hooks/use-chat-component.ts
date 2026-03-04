export const useChatComponent = () => {
  const triggerNewChatSession = () => {
    const chatComponentIframe = document
      .querySelector("mentor-ai")
      ?.shadowRoot?.querySelector("iframe");
    if (chatComponentIframe) {
      chatComponentIframe.contentWindow?.postMessage(
        {
          reason: "NEW_CHAT_SESSION",
        },
        "*",
      );
    }
  };

  return { triggerNewChatSession };
};
