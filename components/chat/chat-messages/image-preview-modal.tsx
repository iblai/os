import { X } from 'lucide-react';

type Props = {
  url: string;
  onClose: () => void;
};

export function ImagePreviewModal({ url, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <button
          className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={url || '/placeholder.svg'}
          alt="Preview"
          className="h-[80vh] w-auto max-w-[90%] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
