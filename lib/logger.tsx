'use client';

import { getUserName } from '@/features/utils';
import { getMentorIdFromUrl, getTenantKeyFromUrl } from '@/lib/utils';
import { LOCAL_STORAGE_KEYS } from './constants';

// lib/console-overrides.ts
function formatDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function getSessionIdFromLocalStorage(mentorId: string | null) {
  if (!mentorId) return '';
  if (typeof window === 'undefined' || typeof localStorage?.getItem !== 'function') return '';

  try {
    const sessionIds = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_ID);
    if (!sessionIds) return '';
    const sessionId = JSON.parse(sessionIds) as Record<string, string>;

    return sessionId[mentorId] ?? '';
  } catch {
    return '';
  }
}

function getTenantKeyPrefix() {
  if (typeof window === 'undefined') return '';

  try {
    const tenantKey = getTenantKeyFromUrl();
    return tenantKey ? ` [${tenantKey}]` : '';
  } catch {
    return '';
  }
}

function formatLogMessageMetadata() {
  if (typeof window === 'undefined') return '';

  const metadata: string[] = [];

  const date = formatDateTime();
  /* istanbul ignore else -- @preserve formatDateTime always returns a non-empty string */
  if (date) metadata.push(date);

  try {
    const mentorId = getMentorIdFromUrl();
    if (mentorId) metadata.push(`mentorId: ${mentorId}`);

    const username = getUserName();
    if (username) metadata.push(`username: ${username}`);

    const sessionId = getSessionIdFromLocalStorage(mentorId);
    if (sessionId) metadata.push(`sessionId: ${sessionId}`);
  } catch (e) {
    // Silently fail if any metadata is unavailable
  }

  /* istanbul ignore next -- @preserve metadata always has at least the date */
  return metadata.length > 0 ? ` [${metadata.join('] [')}]` : '';
}

// Keep original references
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Helper to stringify objects in args
function stringifyArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack}`;
    }
    if (arg !== null && typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return arg;
  });
}

console.log = (...args: any[]) => {
  originalLog.apply(console, [
    `[LOG]${getTenantKeyPrefix()}`,
    ...stringifyArgs(args),
    formatLogMessageMetadata(),
  ]);
};

console.warn = (...args: any[]) => {
  originalWarn.apply(console, [
    `[WARN]${getTenantKeyPrefix()}`,
    ...stringifyArgs(args),
    formatLogMessageMetadata(),
  ]);
};

console.error = (...args: any[]) => {
  originalError.apply(console, [
    `[ERROR]${getTenantKeyPrefix()}`,
    ...stringifyArgs(args),
    formatLogMessageMetadata(),
  ]);
};

export default function ConsoleSetup() {
  return null; // This component just runs the override
}
