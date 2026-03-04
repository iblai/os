"use client";

import { FileUp } from "lucide-react";

interface FileDropZoneProps {
  onDrop?: (files: File[]) => void;
}

export function FileDropZone({}: FileDropZoneProps) {
  return (
    <div className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-white/50 p-10 text-center backdrop-blur-sm transition-all duration-200 hover:border-gray-400">
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="relative">
          <div className="absolute -inset-1 rounded-md bg-gradient-to-r from-[#2563EB] to-[#93C5FD] opacity-50 blur-md"></div>
          <div className="relative rounded-md bg-gradient-to-r from-[#2563EB]/85 to-[#93C5FD]/85 p-3">
            <div className="flex items-center justify-center">
              <FileUp className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          <p className="text-xl font-semibold text-gray-800">
            Drop your files here
          </p>
          <p className="text-sm text-gray-500">
            Drop any file here to add it to the conversation
          </p>
        </div>
      </div>
    </div>
  );
}
