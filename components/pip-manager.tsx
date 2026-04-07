'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Extend Window interface for Document Picture-in-Picture API
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: {
        width?: number;
        height?: number;
        disallowReturnToOpener?: boolean;
      }) => Promise<Window>;
      window: Window | null;
    };
  }
}

interface PipManagerProps {
  children: ReactNode;
  width?: number;
  height?: number;
  /**
   * Render prop for the trigger button/element
   */
  renderTrigger?: (props: {
    onClick: () => void;
    isSupported: boolean;
    isOpen: boolean;
  }) => ReactNode;
}

/**
 * Copy styles from the main document to the PiP window
 */
const copyStyles = (targetDoc: Document): void => {
  const stylesheets = Array.from(document.styleSheets);

  stylesheets.forEach((sheet) => {
    try {
      if (sheet.cssRules) {
        const newStyle = targetDoc.createElement('style');
        Array.from(sheet.cssRules).forEach((rule) => {
          newStyle.appendChild(targetDoc.createTextNode(rule.cssText));
        });
        targetDoc.head.appendChild(newStyle);
      } else if (sheet.href) {
        const newLink = targetDoc.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = sheet.href;
        targetDoc.head.appendChild(newLink);
      }
    } catch {
      // Handles cross-origin issues for external fonts/styles
      if (sheet.href) {
        const link = targetDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        targetDoc.head.appendChild(link);
      }
    }
  });

  // Add base styles for full height
  const baseStyles = targetDoc.createElement('style');
  baseStyles.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  `;
  targetDoc.head.appendChild(baseStyles);
};

/**
 * PipManager - Picture-in-Picture Manager component
 *
 * Uses the Document Picture-in-Picture API to create a floating window
 * that can display React components outside the main browser window.
 */
export function PipManager({
  children,
  width = 400,
  height = 400,
  renderTrigger,
}: PipManagerProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check if Document Picture-in-Picture API is supported
  useEffect(() => {
    setIsSupported('documentPictureInPicture' in window);
  }, []);

  const startPiP = useCallback(async () => {
    if (!window.documentPictureInPicture) {
      console.warn('Document Picture-in-Picture API is not supported');
      return;
    }

    try {
      const newWindow = await window.documentPictureInPicture.requestWindow({
        width,
        height,
      });

      // Copy styles to the new window
      copyStyles(newWindow.document);

      // Handle closing the window via the "X" button
      newWindow.addEventListener('pagehide', () => setPipWindow(null));

      setPipWindow(newWindow);
    } catch (error) {
      console.error('Failed to open Picture-in-Picture window:', error);
    }
  }, [width, height]);

  const isOpen = pipWindow !== null;

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onClick: startPiP, isSupported, isOpen })
      ) : (
        <button
          onClick={startPiP}
          disabled={!isSupported}
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isOpen ? 'Floating Window Open' : 'Open Floating Window'}
        </button>
      )}
      {/* If pipWindow exists, "teleport" the children into it */}
      {pipWindow && createPortal(children, pipWindow.document.body)}
    </>
  );
}

// Export types for external use
export type { PipManagerProps };
