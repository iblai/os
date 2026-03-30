import { platform } from "@tauri-apps/plugin-os";
import { isTauriApp } from "@/types/tauri";

export const useOS = () => {
  let isAppleDevice = false;
  if (isTauriApp()) {
    try {
      const os = platform();
      isAppleDevice = os === "macos" || os === "ios";
    } catch {
      // OS plugin may not be ready yet during early renders
    }
  }

  return {
    isAppleDevice,
  };
};
