import { platform } from "@tauri-apps/plugin-os";

export const useOS = () => {
  let isAppleDevice = false;
  try {
    const os = platform();
    isAppleDevice = os === "macos" || os === "ios";
  } catch {
    isAppleDevice = false;
  }

  return {
    isAppleDevice,
  };
};
