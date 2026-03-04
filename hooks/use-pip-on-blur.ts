'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Room, LocalTrackPublication, LocalTrack, RemoteParticipant } from 'livekit-client';
import { RoomEvent, Track, ParticipantEvent } from 'livekit-client';
import { PipChat } from '@/components/pip-chat';

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

interface UsePipOnBlurOptions {
  /** Whether PIP should be enabled (e.g., screen sharing is active) */
  enabled: boolean;
  /** Width of the PIP window */
  width?: number;
  /** Height of the PIP window */
  height?: number;
  /** LiveKit room to get screen share track from and for chat functionality */
  room?: Room;
  /** Height of the screen share preview (percentage of PIP height) */
  screenSharePreviewHeight?: number;
  /** Callback when PIP window opens */
  onOpen?: () => void;
  /** Callback when PIP window closes */
  onClose?: () => void;
  /** Display name of the mentor, used in PIP chat */
  mentorName?: string;
  /** Callback when user clicks Stop Screensharing in PIP */
  onStopScreenShare?: () => void;
  /** Called when local participant speaking state changes */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Called when remote mentor/AI participant speaking state changes */
  onMentorSpeakingChange?: (speaking: boolean) => void;
  /** Called when mentor audio is toggled from the PIP window */
  onMentorAudioToggled?: (enabled: boolean) => void;
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
 * Create an instruction banner for users when the mentor was opened as a popup
 * Explains that screen sharing is active and they should return to the original window
 */
const createPopupInstructionBanner = (pipDoc: Document): HTMLElement | null => {
  // Only show if we have an opener window (opened as a popup)
  if (!window.opener || window.opener.closed) {
    return null;
  }

  const banner = pipDoc.createElement('div');
  banner.style.cssText = `
    width: 100%;
    padding: 12px 14px;
    background: linear-gradient(135deg, #1e3a5f 0%, #1a2d45 100%);
    border-bottom: 1px solid rgba(59, 130, 246, 0.3);
    flex-shrink: 0;
  `;

  // Info icon SVG
  const infoIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" x2="12" y1="16" y2="12"/>
    <line x1="12" x2="12.01" y1="8" y2="8"/>
  </svg>`;

  banner.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      ${infoIcon}
      <div style="flex: 1;">
        <div style="font-size: 13px; font-weight: 600; color: #93c5fd; margin-bottom: 4px; font-family: system-ui, -apple-system, sans-serif;">
          Screen Sharing Active
        </div>
        <div style="font-size: 12px; color: #d1d5db; line-height: 1.4; font-family: system-ui, -apple-system, sans-serif;">
          You can continue chatting here, or switch back to the original window to access the full conversation.
        </div>
      </div>
    </div>
  `;

  return banner;
};

/**
 * Create the audio status bar with speaking indicator, mute button, and privacy warning
 * Uses the app's theme colors: blue (#2563EB) for active states, white/gray for text
 */
const createAudioStatusBar = (
  pipDoc: Document,
  room: Room,
  onStopScreenShare?: () => void,
  onSpeakingChange?: (speaking: boolean) => void,
  onMentorSpeakingChange?: (speaking: boolean) => void,
  onMentorAudioToggled?: (enabled: boolean) => void,
): { element: HTMLElement; cleanup: () => void } => {
  const statusBar = pipDoc.createElement('div');
  statusBar.style.cssText = `
    width: 100%;
    background: #1a1a1a;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  `;

  // ── Mentor row: speaking indicator + mute button ──
  const mentorRow = pipDoc.createElement('div');
  mentorRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Mentor speaking indicator container with label
  const mentorSpeakingContainer = pipDoc.createElement('div');
  mentorSpeakingContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  `;

  // Mentor speaking indicator circle
  const mentorSpeakingIndicator = pipDoc.createElement('div');
  mentorSpeakingIndicator.style.cssText = `
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #6b7280;
    transition: all 0.2s ease;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.3);
  `;

  // Mentor speaking label
  const mentorSpeakingLabel = pipDoc.createElement('span');
  mentorSpeakingLabel.style.cssText = `
    font-size: 11px;
    color: #9ca3af;
    font-family: system-ui, -apple-system, sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  mentorSpeakingLabel.textContent = 'Mentor';

  mentorSpeakingContainer.appendChild(mentorSpeakingIndicator);
  mentorSpeakingContainer.appendChild(mentorSpeakingLabel);

  // ── Mic row: speaking indicator + mute button ──
  const micRow = pipDoc.createElement('div');
  micRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Mic speaking indicator container with label
  const micSpeakingContainer = pipDoc.createElement('div');
  micSpeakingContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  `;

  // Mic speaking indicator circle
  const micSpeakingIndicator = pipDoc.createElement('div');
  micSpeakingIndicator.style.cssText = `
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #6b7280;
    transition: all 0.2s ease;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.3);
  `;

  // Mic speaking label
  const micSpeakingLabel = pipDoc.createElement('span');
  micSpeakingLabel.style.cssText = `
    font-size: 11px;
    color: #9ca3af;
    font-family: system-ui, -apple-system, sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  micSpeakingLabel.textContent = 'Mic';

  micSpeakingContainer.appendChild(micSpeakingIndicator);
  micSpeakingContainer.appendChild(micSpeakingLabel);

  // Helper to create a round icon button
  const createIconButton = (title: string, ariaLabel: string) => {
    const btn = pipDoc.createElement('button');
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.2);
      background: transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
    `;
    btn.title = title;
    btn.setAttribute('aria-label', ariaLabel);
    return btn;
  };

  // ── Mentor mute button (speaker icon – controls incoming audio) ──
  const mentorMuteButton = createIconButton(
    'Click to mute/unmute mentor audio',
    'Toggle mentor audio',
  );

  // Speaker on icon SVG (unmuted state)
  const speakerOnSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>`;

  // Speaker off icon SVG (muted state)
  const speakerOffSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" x2="17" y1="9" y2="15"/>
    <line x1="17" x2="23" y1="9" y2="15"/>
  </svg>`;

  // Track mentor audio muted state (starts unmuted)
  let isMentorMuted = false;
  mentorMuteButton.innerHTML = speakerOnSvg;

  // ── Mic mute button (microphone icon – controls user's mic) ──
  const micMuteButton = createIconButton('Click to mute/unmute', 'Toggle microphone');

  // Microphone icon SVG (unmuted state)
  const micOnSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>`;

  // Microphone off icon SVG (muted state)
  const micOffSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
    <path d="M5 10v2a7 7 0 0 0 12 5.89"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>`;

  // Set initial mic state
  const isMicMuted = !room.localParticipant.isMicrophoneEnabled;
  micMuteButton.innerHTML = isMicMuted ? micOffSvg : micOnSvg;
  if (isMicMuted) {
    micMuteButton.style.borderColor = '#dc2626';
    micMuteButton.style.background = 'rgba(220, 38, 38, 0.1)';
  }

  // Update mentor speaking indicator based on mentor's state
  const updateMentorSpeakingIndicator = (isSpeaking: boolean) => {
    if (isSpeaking && !isMentorMuted) {
      // Mentor speaking - bright green with strong glow
      mentorSpeakingIndicator.style.background = '#22c55e';
      mentorSpeakingIndicator.style.borderColor = '#22c55e';
      mentorSpeakingIndicator.style.boxShadow = '0 0 8px #22c55e, 0 0 16px rgba(34, 197, 94, 0.6)';
      mentorSpeakingIndicator.style.transform = 'scale(1.2)';
      mentorSpeakingLabel.style.color = '#22c55e';
      mentorSpeakingLabel.textContent = 'Mentor speaking';
    } else if (!isMentorMuted) {
      // Mentor audio on but not speaking - subtle blue
      mentorSpeakingIndicator.style.background = '#3b82f6';
      mentorSpeakingIndicator.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      mentorSpeakingIndicator.style.boxShadow = 'none';
      mentorSpeakingIndicator.style.transform = 'scale(1)';
      mentorSpeakingLabel.style.color = '#9ca3af';
      mentorSpeakingLabel.textContent = 'Mentor audio on';
    } else {
      // Mentor muted - red indicator
      mentorSpeakingIndicator.style.background = '#dc2626';
      mentorSpeakingIndicator.style.borderColor = '#dc2626';
      mentorSpeakingIndicator.style.boxShadow = 'none';
      mentorSpeakingIndicator.style.transform = 'scale(1)';
      mentorSpeakingLabel.style.color = '#dc2626';
      mentorSpeakingLabel.textContent = 'Mentor muted';
    }
  };

  // Update mic speaking indicator based on local participant's state
  const updateMicSpeakingIndicator = (isSpeaking: boolean) => {
    if (isSpeaking && room.localParticipant.isMicrophoneEnabled) {
      // User speaking - bright green with strong glow
      micSpeakingIndicator.style.background = '#22c55e';
      micSpeakingIndicator.style.borderColor = '#22c55e';
      micSpeakingIndicator.style.boxShadow = '0 0 8px #22c55e, 0 0 16px rgba(34, 197, 94, 0.6)';
      micSpeakingIndicator.style.transform = 'scale(1.2)';
      micSpeakingLabel.style.color = '#22c55e';
      micSpeakingLabel.textContent = 'Speaking';
    } else if (room.localParticipant.isMicrophoneEnabled) {
      // Mic on but not speaking - subtle blue
      micSpeakingIndicator.style.background = '#3b82f6';
      micSpeakingIndicator.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      micSpeakingIndicator.style.boxShadow = 'none';
      micSpeakingIndicator.style.transform = 'scale(1)';
      micSpeakingLabel.style.color = '#9ca3af';
      micSpeakingLabel.textContent = 'Mic on';
    } else {
      // Muted - red indicator
      micSpeakingIndicator.style.background = '#dc2626';
      micSpeakingIndicator.style.borderColor = '#dc2626';
      micSpeakingIndicator.style.boxShadow = 'none';
      micSpeakingIndicator.style.transform = 'scale(1)';
      micSpeakingLabel.style.color = '#dc2626';
      micSpeakingLabel.textContent = 'Muted';
    }
  };

  // Update mentor mute button UI
  const updateMentorMuteButton = (muted: boolean) => {
    mentorMuteButton.innerHTML = muted ? speakerOffSvg : speakerOnSvg;
    if (muted) {
      mentorMuteButton.style.borderColor = '#dc2626';
      mentorMuteButton.style.background = 'rgba(220, 38, 38, 0.1)';
    } else {
      mentorMuteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      mentorMuteButton.style.background = 'transparent';
    }
    // Get current speaking state from remote participant
    const remoteParticipant = Array.from(room.remoteParticipants.values())[0];
    updateMentorSpeakingIndicator(remoteParticipant?.isSpeaking ?? false);
  };

  // Update mic mute button UI
  const updateMicMuteButton = (muted: boolean) => {
    micMuteButton.innerHTML = muted ? micOffSvg : micOnSvg;
    if (muted) {
      micMuteButton.style.borderColor = '#dc2626';
      micMuteButton.style.background = 'rgba(220, 38, 38, 0.1)';
    } else {
      micMuteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      micMuteButton.style.background = 'transparent';
    }
  };

  // Mentor mute button click handler - toggles incoming mentor audio
  const handleMentorMuteClick = () => {
    try {
      isMentorMuted = !isMentorMuted;
      room.remoteParticipants.forEach((participant) => {
        participant.setVolume(isMentorMuted ? 0 : 1);
      });
      updateMentorMuteButton(isMentorMuted);
      postStatusToOpener('MENTOR:SCREENSHARING_MENTOR_MUTED', { muted: isMentorMuted });
      onMentorAudioToggled?.(!isMentorMuted);
    } catch (error) {
      console.error('Failed to toggle mentor audio:', error);
    }
  };

  mentorMuteButton.addEventListener('click', handleMentorMuteClick);

  // Hover effects for mentor mute button
  mentorMuteButton.addEventListener('mouseenter', () => {
    if (isMentorMuted) {
      mentorMuteButton.style.background = 'rgba(220, 38, 38, 0.2)';
    } else {
      mentorMuteButton.style.borderColor = '#93C5FD';
      mentorMuteButton.style.background = 'rgba(37, 99, 235, 0.1)';
    }
  });
  mentorMuteButton.addEventListener('mouseleave', () => {
    if (isMentorMuted) {
      mentorMuteButton.style.borderColor = '#dc2626';
      mentorMuteButton.style.background = 'rgba(220, 38, 38, 0.1)';
    } else {
      mentorMuteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      mentorMuteButton.style.background = 'transparent';
    }
  });

  // Mic mute button click handler - toggles user's microphone
  const handleMicMuteClick = async () => {
    try {
      const currentlyMuted = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(currentlyMuted);
      updateMicMuteButton(!currentlyMuted);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  };

  micMuteButton.addEventListener('click', handleMicMuteClick);

  // Hover effects for mic mute button
  micMuteButton.addEventListener('mouseenter', () => {
    if (!room.localParticipant.isMicrophoneEnabled) {
      micMuteButton.style.background = 'rgba(220, 38, 38, 0.2)';
    } else {
      micMuteButton.style.borderColor = '#93C5FD';
      micMuteButton.style.background = 'rgba(37, 99, 235, 0.1)';
    }
  });
  micMuteButton.addEventListener('mouseleave', () => {
    if (!room.localParticipant.isMicrophoneEnabled) {
      micMuteButton.style.borderColor = '#dc2626';
      micMuteButton.style.background = 'rgba(220, 38, 38, 0.1)';
    } else {
      micMuteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      micMuteButton.style.background = 'transparent';
    }
  });

  // Assemble mentor row
  mentorRow.appendChild(mentorSpeakingContainer);
  mentorRow.appendChild(mentorMuteButton);

  // Assemble mic row
  micRow.appendChild(micSpeakingContainer);
  micRow.appendChild(micMuteButton);

  // Assemble the status bar
  statusBar.appendChild(mentorRow);
  statusBar.appendChild(micRow);

  // Stop Screensharing button
  let handleStopClick: (() => void) | undefined;
  let stopButton: HTMLButtonElement | undefined;
  if (onStopScreenShare) {
    stopButton = pipDoc.createElement('button');
    stopButton.style.cssText = `
      width: 100%;
      padding: 6px 12px;
      background: rgba(220, 38, 38, 0.15);
      border: 1px solid rgba(220, 38, 38, 0.4);
      border-radius: 6px;
      color: #f87171;
      font-size: 12px;
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    `;
    stopButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> Stop Sharing`;
    stopButton.title = 'Stop screen sharing';
    stopButton.setAttribute('aria-label', 'Stop screen sharing');

    stopButton.addEventListener('mouseenter', () => {
      stopButton!.style.background = 'rgba(220, 38, 38, 0.3)';
      stopButton!.style.borderColor = '#dc2626';
    });
    stopButton.addEventListener('mouseleave', () => {
      stopButton!.style.background = 'rgba(220, 38, 38, 0.15)';
      stopButton!.style.borderColor = 'rgba(220, 38, 38, 0.4)';
    });

    handleStopClick = () => {
      onStopScreenShare();
    };
    stopButton.addEventListener('click', handleStopClick);
    statusBar.appendChild(stopButton);
  }

  // Initialize speaking indicators
  const initialRemoteParticipant = Array.from(room.remoteParticipants.values())[0];
  updateMentorSpeakingIndicator(initialRemoteParticipant?.isSpeaking ?? false);
  updateMicSpeakingIndicator(room.localParticipant.isSpeaking);

  // Helper to post status to parent window
  const postStatusToOpener = (type: string, data?: Record<string, unknown>) => {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type, ...data }, '*');
      } catch (error) {
        console.error('Failed to post status to opener:', error);
      }
    }
  };

  // Event handler for remote participant speaking changes
  const handleRemoteSpeakingChanged = (speaking: boolean) => {
    updateMentorSpeakingIndicator(speaking);
    postStatusToOpener('MENTOR:SCREENSHARING_MENTOR_SPEAKING', { speaking });
    onMentorSpeakingChange?.(speaking);
  };

  // Event handler for local participant speaking changes
  const handleLocalSpeakingChanged = (speaking: boolean) => {
    updateMicSpeakingIndicator(speaking);
    postStatusToOpener('MENTOR:SCREENSHARING_SPEAKING', { speaking });
    onSpeakingChange?.(speaking);
  };

  // Handle new remote participants joining (mentor agent may connect after us)
  const handleParticipantConnected = (participant: RemoteParticipant) => {
    if (isMentorMuted) {
      participant.setVolume(0);
    }
    participant.on(ParticipantEvent.IsSpeakingChanged, handleRemoteSpeakingChanged);
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    participant.off(ParticipantEvent.IsSpeakingChanged, handleRemoteSpeakingChanged);
  };

  // Subscribe to existing remote participants' speaking events
  room.remoteParticipants.forEach((participant) => {
    participant.on(ParticipantEvent.IsSpeakingChanged, handleRemoteSpeakingChanged);
  });

  // Listen for new remote participants
  room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
  room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

  // Event handlers for local mic track events
  const handleTrackMuted = (publication: { source: Track.Source }) => {
    if (publication.source === Track.Source.Microphone) {
      updateMicMuteButton(true);
      updateMicSpeakingIndicator(room.localParticipant.isSpeaking);
      postStatusToOpener('MENTOR:SCREENSHARING_MUTED', { muted: true });
    }
  };

  const handleTrackUnmuted = (publication: { source: Track.Source }) => {
    if (publication.source === Track.Source.Microphone) {
      updateMicMuteButton(false);
      updateMicSpeakingIndicator(room.localParticipant.isSpeaking);
      postStatusToOpener('MENTOR:SCREENSHARING_MUTED', { muted: false });
    }
  };

  // Subscribe to local participant events
  room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, handleLocalSpeakingChanged);
  room.localParticipant.on(ParticipantEvent.TrackMuted, handleTrackMuted);
  room.localParticipant.on(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);

  // Listen for mentor mute command from opener window
  const handleMentorMuteMessage = (event: MessageEvent) => {
    if (event.data?.type === 'MENTOR:SCREENSHARING_MENTOR_MUTED') {
      handleMentorMuteClick();
    }
  };
  window.addEventListener('message', handleMentorMuteMessage);

  // Listen for user mic mute command from opener window
  const handleMicMuteMessage = (event: MessageEvent) => {
    if (event.data?.type === 'MENTOR:SCREENSHARING_MUTED') {
      handleMicMuteClick();
    }
  };
  window.addEventListener('message', handleMicMuteMessage);

  // Cleanup function
  const cleanup = () => {
    mentorMuteButton.removeEventListener('click', handleMentorMuteClick);
    micMuteButton.removeEventListener('click', handleMicMuteClick);
    if (stopButton && handleStopClick) {
      stopButton.removeEventListener('click', handleStopClick);
    }
    window.removeEventListener('message', handleMentorMuteMessage);
    window.removeEventListener('message', handleMicMuteMessage);
    room.remoteParticipants.forEach((participant) => {
      participant.off(ParticipantEvent.IsSpeakingChanged, handleRemoteSpeakingChanged);
    });
    room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.localParticipant.off(ParticipantEvent.IsSpeakingChanged, handleLocalSpeakingChanged);
    room.localParticipant.off(ParticipantEvent.TrackMuted, handleTrackMuted);
    room.localParticipant.off(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);
  };

  return { element: statusBar, cleanup };
};

/**
 * Get the screen share video track from a LiveKit room
 */
const getScreenShareTrack = (room: Room): LocalTrackPublication | undefined => {
  // Try multiple ways to find the screen share track
  const publications = Array.from(room.localParticipant.trackPublications.values());

  const screenSharePub = publications.find((pub) => {
    // Check various ways the source might be identified
    // Cast to string to allow comparison with various source string values
    const sourceStr = pub.source as string;
    const trackSourceStr = pub.track?.source as string;
    const isScreenShare =
      sourceStr === 'screen_share' ||
      sourceStr === 'screen_share_video' ||
      trackSourceStr === 'screen_share' ||
      pub.trackName?.includes('screen') ||
      pub.track?.kind === 'video';

    return isScreenShare && pub.track;
  });

  return screenSharePub as LocalTrackPublication | undefined;
};

/**
 * Hook that opens a PIP window when the main window loses focus
 * Useful for keeping content visible during screen sharing
 */
export function usePipOnBlur({
  enabled,
  width = 400,
  height = 600,
  room,
  screenSharePreviewHeight = 30,
  onOpen,
  onClose,
  mentorName,
  onStopScreenShare,
  onSpeakingChange,
  onMentorSpeakingChange,
  onMentorAudioToggled,
}: UsePipOnBlurOptions) {
  const pipWindowRef = useRef<Window | null>(null);
  const isOpeningRef = useRef(false);
  // Track when PIP was just opened to prevent immediate close from focus state
  const justOpenedRef = useRef(false);
  // Track when PIP was just closed to allow browser cleanup before reopening
  const justClosedRef = useRef(false);
  // Use ref for onStopScreenShare to avoid recreating openPip when callback changes
  const onStopScreenShareRef = useRef(onStopScreenShare);
  onStopScreenShareRef.current = onStopScreenShare;
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;
  const onMentorSpeakingChangeRef = useRef(onMentorSpeakingChange);
  onMentorSpeakingChangeRef.current = onMentorSpeakingChange;
  const onMentorAudioToggledRef = useRef(onMentorAudioToggled);
  onMentorAudioToggledRef.current = onMentorAudioToggled;

  const openPip = useCallback(async () => {
    // Prevent multiple simultaneous open attempts
    if (isOpeningRef.current || pipWindowRef.current || justClosedRef.current) {
      console.log('[PIP] Skipping open - already opening or open', {
        isOpening: isOpeningRef.current,
        hasWindow: !!pipWindowRef.current,
      });
      return;
    }

    // Also check if Document PIP API still has an active window
    if (window.documentPictureInPicture?.window) {
      console.log('[PIP] Closing stale Document PIP window before reopening');
      window.documentPictureInPicture.window.close();
    }

    if (!window.documentPictureInPicture) {
      console.warn('Document Picture-in-Picture API is not supported');
      return;
    }

    isOpeningRef.current = true;

    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width,
        height,
      });

      // Copy styles to the new window
      copyStyles(pipWindow.document);

      // Create container for layout
      const container = pipWindow.document.createElement('div');
      container.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `;

      // Only create screen share preview if screenSharePreviewHeight > 0
      if (screenSharePreviewHeight > 0 && room) {
        // Create screen share preview container at the top
        const screenShareContainer = pipWindow.document.createElement('div');
        screenShareContainer.style.cssText = `
          width: 100%;
          height: ${screenSharePreviewHeight}%;
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
        `;

        // Add label for screen share
        const label = pipWindow.document.createElement('div');
        label.style.cssText = `
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: system-ui, -apple-system, sans-serif;
          z-index: 10;
        `;
        label.textContent = 'Screen Share Preview';
        screenShareContainer.appendChild(label);

        // Create video element that will be used for the screen share
        const video = pipWindow.document.createElement('video');
        video.style.cssText = `
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: none;
        `;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        screenShareContainer.appendChild(video);

        // Create placeholder that shows while waiting for track
        const placeholder = pipWindow.document.createElement('div');
        placeholder.style.cssText = `
          color: #666;
          font-size: 14px;
          font-family: system-ui, -apple-system, sans-serif;
        `;
        placeholder.textContent = 'Screen share loading...';
        screenShareContainer.appendChild(placeholder);

        // Function to attach the track to video
        const attachTrack = (track: LocalTrack) => {
          track.attach(video);
          video.style.display = 'block';
          placeholder.style.display = 'none';
        };

        // Try to get existing screen share track
        const screenSharePub = getScreenShareTrack(room);
        if (screenSharePub?.track) {
          attachTrack(screenSharePub.track as LocalTrack);
        } else {
          // Listen for track to be published
          const handleTrackPublished = (publication: LocalTrackPublication) => {
            // Cast to string to allow comparison with various source string values
            const sourceStr = publication.source as string;
            if (
              sourceStr === 'screen_share' ||
              sourceStr === 'screen_share_video' ||
              (publication.track?.kind === 'video' && !screenSharePub)
            ) {
              if (publication.track) {
                attachTrack(publication.track as LocalTrack);
              }
            }
          };

          room.localParticipant.on(RoomEvent.LocalTrackPublished as any, handleTrackPublished);

          // Cleanup listener when PIP closes
          pipWindow.addEventListener('pagehide', () => {
            room.localParticipant.off(RoomEvent.LocalTrackPublished as any, handleTrackPublished);
          });
        }

        container.appendChild(screenShareContainer);
      }

      // Add audio status bar with speaking indicator, mute button, and privacy warning
      let audioStatusBarCleanup: (() => void) | undefined;
      if (room) {
        const { element: audioStatusBar, cleanup } = createAudioStatusBar(
          pipWindow.document,
          room,
          onStopScreenShareRef.current,
          onSpeakingChangeRef.current,
          onMentorSpeakingChangeRef.current,
          onMentorAudioToggledRef.current,
        );
        container.appendChild(audioStatusBar);
        audioStatusBarCleanup = cleanup;
      }

      // Add instruction banner for popup windows (when opened from another window)
      const instructionBanner = createPopupInstructionBanner(pipWindow.document);
      if (instructionBanner) {
        container.appendChild(instructionBanner);
      }

      // Create React chat container (takes remaining height)
      const chatContainer = pipWindow.document.createElement('div');
      chatContainer.id = 'pip-chat-root';
      chatContainer.style.cssText = `
        flex: 1;
        min-height: 0;
        overflow: hidden;
      `;

      container.appendChild(chatContainer);
      pipWindow.document.body.appendChild(container);

      // Render React chat component
      // PipChat communicates with the parent window via postMessage
      // The parent window (screen sharing popup) handles useChat
      // We pass both parentWindow (for posting messages) and pipWindow (for receiving messages)
      // because React components rendered via createRoot still run in the parent's JS context
      let reactRoot: Root | null = null;
      if (room) {
        reactRoot = createRoot(chatContainer);
        const localParticipantIdentity = room.localParticipant.identity;
        reactRoot.render(
          React.createElement(PipChat, {
            localParticipantIdentity,
            parentWindow: window,
            pipWindow: pipWindow,
            mentorName,
          }),
        );
      }

      // Handle closing the window (e.g., user clicks "back to tab" / maximizes PIP)
      pipWindow.addEventListener('pagehide', () => {
        console.log('[PIP] PIP window closed (pagehide)');
        // Cleanup React root
        reactRoot?.unmount();
        // Cleanup audio status bar event listeners
        audioStatusBarCleanup?.();
        pipWindowRef.current = null;
        isOpeningRef.current = false;
        justOpenedRef.current = false;
        // Cooldown after close to let browser fully clean up before reopening
        justClosedRef.current = true;
        setTimeout(() => {
          justClosedRef.current = false;
        }, 1500);
        onClose?.();
      });

      pipWindowRef.current = pipWindow;
      // Cooldown to let the PIP window settle before polling acts on focus state
      justOpenedRef.current = true;
      setTimeout(() => {
        justOpenedRef.current = false;
      }, 1500);
      onOpen?.();
    } catch (error) {
      console.error('Failed to open Picture-in-Picture window:', error);
    } finally {
      isOpeningRef.current = false;
    }
  }, [width, height, room, screenSharePreviewHeight, onOpen, onClose, mentorName]);

  const closePip = useCallback(() => {
    if (pipWindowRef.current) {
      console.log('[PIP] Closing PIP programmatically');
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    isOpeningRef.current = false;
    justOpenedRef.current = false;
    // Cooldown after closing to let the browser fully clean up the PIP window
    justClosedRef.current = true;
    setTimeout(() => {
      justClosedRef.current = false;
    }, 1500);
  }, []);

  // Open PIP immediately when enabled (screen sharing is connected)
  // PIP stays open for the entire duration of the screen sharing session
  useEffect(() => {
    if (!enabled) {
      closePip();
      return;
    }

    // Open PIP as soon as screen sharing is connected
    openPip();

    return () => {
      closePip();
    };
  }, [enabled, openPip, closePip]);

  return {
    isPipOpen: pipWindowRef.current !== null,
    openPip,
    closePip,
  };
}
