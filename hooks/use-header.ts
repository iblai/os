import { config } from "@/lib/config";
import { isInIframe } from "@/lib/utils";

export function useHeader() {
  const isMentorInFrame = isInIframe();

  const useSpecialIframeLogo =
    config.iblEnableSpecialLogoWhenIframed() === "true" && isMentorInFrame;

  // const logoSize = !isMentorInFrame ? "auto" : "unset";

  return {
    // logoSize,
    useSpecialIframeLogo,
  };
}
