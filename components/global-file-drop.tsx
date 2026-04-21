'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FileDropZone } from './file-drop-zone';
import { useAppDispatch } from '@/lib/hooks';
import { addFiles } from '@iblai/iblai-js/web-utils';

export function GlobalFileDrop() {
  const [isDragging, setIsDragging] = useState(false);
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);

  // Check if we're on a chat page
  const isChatPage = pathname && /\/platform\/[^/]+\/[^/]+$/.test(pathname);

  useEffect(() => {
    // Create a custom event listener for the Add Resource modal state
    const handleAddResourceModalState = (e: CustomEvent) => {
      setIsAddResourceModalOpen(e.detail.isOpen);
    };

    // Add event listener
    window.addEventListener(
      'addResourceModalState' as any,
      handleAddResourceModalState,
    );

    // Clean up
    return () => {
      window.removeEventListener(
        'addResourceModalState' as any,
        handleAddResourceModalState,
      );
    };
  }, []);

  useEffect(() => {
    // Only add event listeners if we're on the chat page
    if (!isChatPage) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files') && !isAddResourceModalOpen) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set isDragging to false if we're leaving the document
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer?.files) {
        const fileList = e.dataTransfer.files;
        const filesArray = Array.from(fileList);
        dispatch(addFiles(filesArray));
      }
    };

    // Add event listeners to the document
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      // Clean up event listeners
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [dispatch, isChatPage, isAddResourceModalOpen]);

  // Don't render anything if we're not on the chat page or not dragging
  if (!isChatPage || !isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md">
        <FileDropZone />
      </div>
    </div>
  );
}
