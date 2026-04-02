import { X } from 'lucide-react';

type Props = {
  url: string;
  onClose: () => void;
};

export function ImagePreviewModal({ url, onClose }: Props) {
  return (
    <div
      className="bg-opacity-75 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
      onClick={onClose}
    >
      <div className="relative flex h-full w-full items-center justify-center">
        <button
          className="bg-opacity-50 hover:bg-opacity-70 absolute top-2 right-2 rounded-full bg-black p-1 text-white"
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
