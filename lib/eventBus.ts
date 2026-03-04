import mitt from "mitt";

const eventBus = mitt();

export enum RemoteEvents {
  newChat = "MENTOR:NEW_CHAT",
  stopChatGenerating = "MENTOR:STOP_CHAT_GENERATING",
}

export default eventBus;
