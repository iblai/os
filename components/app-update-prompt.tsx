'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isTauriApp } from '@/types/tauri';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/** At most one update check per this window (per launch is fine too — the
 * check also runs when the app was simply left open across a day). */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_CHECK_KEY = 'ibl_app_update_last_check';
/** "Skip This Version" persists here; a LATER version prompts again. */
const SKIP_KEY = 'ibl_app_update_skip_version';

interface UpdateInfo {
  available: boolean;
  supported?: boolean;
  version?: string;
  /** Present on mobile: the store page to open. Absent on desktop, where the
   * host installs the update in place. */
  url?: string;
  notes?: string;
}

/**
 * Tauri-only "a newer version is available" prompt, mounted globally.
 *
 * One Rust command (`check_app_update`) answers on every platform; what the
 * Update button does differs: desktop runs `install_app_update` (download +
 * signature check + install + relaunch, progress via `app-update:progress`),
 * mobile opens the App Store / Play Store page from the check's `url`.
 * Renders nothing outside Tauri, in dev builds, in the Mac App Store build
 * (all report unsupported/unavailable), or for a version the user skipped.
 */
export function AppUpdatePrompt() {
  const t = useTranslations('appUpdatePrompt');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [installError, setInstallError] = useState('');
  const checked = useRef(false);

  useEffect(() => {
    if (!isTauriApp() || checked.current) return;
    checked.current = true;
    try {
      const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
      if (Date.now() - last < CHECK_INTERVAL_MS) return;
    } catch {
      /* storage unavailable — check anyway */
    }
    void (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke<UpdateInfo>('check_app_update');
        try {
          localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
        } catch {
          /* best-effort */
        }
        if (!info?.available || !info.version) return;
        try {
          if (localStorage.getItem(SKIP_KEY) === info.version) return;
        } catch {
          /* best-effort */
        }
        setUpdate(info);
      } catch {
        // No network, endpoint without updater artifacts yet, … — never
        // surface a failed background check.
      }
    })();
  }, []);

  if (!update || dismissed) return null;

  const startUpdate = async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    if (update.url) {
      // Mobile: the store owns installation.
      await invoke('open_external_url', { url: update.url }).catch(() => {});
      setDismissed(true);
      return;
    }
    // Desktop: install in place; the app relaunches itself on success.
    setInstalling(true);
    setInstallError('');
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<{ downloaded: number; total?: number }>(
      'app-update:progress',
      (e) => {
        const { downloaded, total } = e.payload || { downloaded: 0 };
        if (total) setProgress(Math.min(100, (downloaded / total) * 100));
      },
    );
    try {
      await invoke('install_app_update');
    } catch (err) {
      setInstalling(false);
      setProgress(null);
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      unlisten();
    }
  };

  const skipThisVersion = () => {
    try {
      localStorage.setItem(SKIP_KEY, update.version || '');
    } catch {
      /* best-effort */
    }
    setDismissed(true);
  };

  return (
    <AlertDialog open>
      <AlertDialogContent data-testid="app-update-prompt">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('description', { version: update.version ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {update.notes && (
          <p className="max-h-32 overflow-y-auto text-xs whitespace-pre-wrap text-gray-500">
            {update.notes}
          </p>
        )}
        {installing && (
          <div
            data-testid="app-update-progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              // Indeterminate until the first sized progress event lands.
              style={{ width: `${progress ?? 8}%` }}
            />
          </div>
        )}
        {installError && (
          <p className="text-xs break-all text-red-600">{installError}</p>
        )}
        <AlertDialogFooter>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={installing}
            onClick={skipThisVersion}
          >
            {t('skip')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={installing}
            onClick={() => setDismissed(true)}
          >
            {t('later')}
          </Button>
          <Button
            size="sm"
            type="button"
            disabled={installing}
            onClick={() => void startUpdate()}
          >
            {installing ? t('updating') : t('updateNow')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
