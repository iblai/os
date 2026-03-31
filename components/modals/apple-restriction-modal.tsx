import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { isTauriApp } from "@/types/tauri";
import { Smartphone } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function AppleRestrictionModal({ isOpen, onClose }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm gap-0 p-0 overflow-hidden rounded-2xl"
      >
        <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
          {/* Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Smartphone className="h-8 w-8 text-gray-500" strokeWidth={1.5} />
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
              You can&apos;t subscribe here
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-gray-500">
              Due to Apple guidelines, we&apos;re not able to offer purchases
              inside the app on iPhone and iPad. You can subscribe on the web
              instead.
            </DialogDescription>
          </div>

          {/* CTA */}
          <div className="flex w-full flex-col gap-3">
            <a
              href="https://www.ibl.ai/pricing"
              onClick={async (e) => {
                if (isTauriApp()) {
                  e.preventDefault();
                  const { openUrl } = await import("@tauri-apps/plugin-opener");
                  await openUrl("https://www.ibl.ai/pricing");
                }
                onClose();
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="ibl-button-primary flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold"
            >
              Go to ibl.ai/pricing
            </a>
            <button
              onClick={onClose}
              className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
