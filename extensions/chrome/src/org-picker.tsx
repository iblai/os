import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './brand-mark';
import { t } from './i18n';
import {
  listOrganizations,
  NoSessionError,
  setDefaultOrganization,
  type Organization,
} from './organizations';

interface OrgPickerProps {
  /** The one the panel is in now, marked Current and not offered as a choice. */
  current: string | null;
  onPick: (key: string) => void;
  onCancel: () => void;
  /**
   * How the last pick went, when it did not simply work. Passed as the outcome
   * rather than a finished sentence: the names live here, so the key the switch
   * reports can be shown as the name on the row above it.
   */
  notice?: { kind: 'failed' } | { kind: 'elsewhere'; landed: string } | null;
  /** A switch is under way: the rows give way to the mark until it lands. */
  switching?: boolean;
}

const COPIED_FOR_MS = 1500;

/**
 * Pick an organization, in the panel.
 *
 * Deliberately the same screen as the auth app's own chooser
 * (`apps/auth/app/(auth)/me` in iblai-web-frontend): same title and sentence,
 * same row shape, the key under the name with copy-to-clipboard, the same
 * Current / Default / Admin badges, the same "Set default" wording, and the
 * same ordering — default first, then the order the source gave us. It
 * replaces that page for the side panel, so the two should not feel like
 * different products; this one just does it without a browser tab and without
 * a credential in the address.
 */
export function OrgPicker({
  current,
  onPick,
  onCancel,
  notice,
  switching = false,
}: OrgPickerProps) {
  const [organizations, setOrganizations] = useState<Organization[] | null>(
    null,
  );
  const [preferred, setPreferred] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');

  // The dialog itself is the focus target: it is the one node that stays
  // mounted through every state, and it is not activatable — focusing a button
  // lets a held Enter press it, and focusing a transient note drops the
  // keyboard on <body> when that note gives way.
  const dialogRef = useRef<HTMLDivElement>(null);
  // Read through a ref so the effect below can run once. Keyed on `onCancel`
  // it re-ran on every parent render and pulled focus off the row the person
  // had arrowed to.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const copiedTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        cancelRef.current();
        return;
      }
      // `aria-modal` promises the keyboard stays here, and the chat is still
      // mounted and focusable underneath — without this, Tab walks straight
      // into an iframe hidden behind an opaque overlay.
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const stops = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!stops.length) {
        // Nothing to land on (mid-switch, say): hold the dialog itself.
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // A new switch makes an older save failure stale: leaving it up would hide
  // the panel's message about the switch itself. The row that started the
  // switch is also about to unmount with the list.
  useEffect(() => {
    if (!switching) return;
    setError(null);
    dialogRef.current?.focus();
  }, [switching]);

  // `attempt` exists so a failed load has a way back: without it the only
  // escape from "check your connection" is closing the dialog and getting the
  // embedded app to raise it again.
  useEffect(() => {
    let live = true;
    const load = async () => {
      setError(null);
      setOrganizations(null);
      try {
        const list = await listOrganizations();
        if (!live) return;
        setOrganizations(list);
        setPreferred(list.find((org) => org.isDefault)?.key ?? null);
      } catch (err) {
        console.error('[ibl.ai panel] could not list organizations:', err);
        if (!live) return;
        // A dead session is not a connection problem, and the fix is different.
        setError(
          err instanceof NoSessionError ? t('orgsSignedOut') : t('orgsFailed'),
        );
        setOrganizations([]);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [attempt]);

  const setDefault = async (key: string) => {
    setSavingKey(key);
    try {
      await setDefaultOrganization(key);
      // Marked once it has actually saved — marking it first would replace the
      // button with the badge and "Setting…" would never be seen.
      setPreferred(key);
      // A later success must clear an earlier failure's message.
      setError(null);
    } catch (err) {
      console.error('[ibl.ai panel] could not save the default:', err);
      // `setDefaultOrganization` raises NoSessionError on a refused token; the
      // fix for that is signing in again, not trying the same save forever.
      setError(
        err instanceof NoSessionError
          ? t('orgsSignedOut')
          : t('defaultOrgFailed'),
      );
    } finally {
      setSavingKey(null);
    }
  };

  const copyKey = (key: string) => {
    void navigator.clipboard?.writeText(key).catch(() => {});
    setCopiedKey(key);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(
      () => setCopiedKey(null),
      COPIED_FOR_MS,
    );
  };

  const named = (key: string) =>
    organizations?.find((org) => org.key === key)?.name ?? key;

  // Whichever message is current wins. The picker's own error is the more
  // specific of the two, but it survives until a later successful save — so a
  // switch starting clears it (above), and a notice from the panel about that
  // switch is then the only one left to show.
  const message =
    error ??
    (notice
      ? notice.kind === 'elsewhere'
        ? t('orgsLandedElsewhere', named(notice.landed))
        : t('orgsSwitchFailed')
      : null);

  const count = organizations?.length ?? 0;

  // Label or key, as the auth app's own organization search does — with 38
  // organizations the list is unusable without it.
  const q = query.trim().toLowerCase();
  const visible = !organizations
    ? []
    : q
      ? organizations.filter(
          (org) =>
            org.name.toLowerCase().includes(q) ||
            org.key.toLowerCase().includes(q),
        )
      : organizations;

  return (
    <div
      ref={dialogRef}
      className="orgs"
      role="dialog"
      aria-modal="true"
      aria-label={t('orgsTitle')}
      tabIndex={-1}
    >
      <div className="orgs-head">
        <div className="orgs-heading">
          <span className="orgs-title">{t('orgsTitle')}</span>
          <span className="orgs-subtitle">{t('orgsSubtitle')}</span>
        </div>
        <button
          type="button"
          className="orgs-close"
          onClick={onCancel}
          title={t('orgsClose')}
          aria-label={t('orgsClose')}
        >
          ×
        </button>
      </div>

      <div className="orgs-card">
        {count > 0 && !switching && (
          <div className="orgs-count">
            {count === 1
              ? t('orgsCountOne')
              : t('orgsCountMany', String(count))}
          </div>
        )}

        {message && (
          <p role="alert" className="orgs-error">
            {message}
          </p>
        )}

        {error === t('orgsFailed') && !switching && (
          // Offered only where retrying is the way forward — a dead session
          // needs a sign-in, not another attempt at the same call.
          <button
            type="button"
            className="orgs-retry"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t('orgsRetry')}
          </button>
        )}

        {switching ? (
          <div className="orgs-waiting">
            <BrandMark label={t('orgsSwitching')} />
          </div>
        ) : organizations === null ? (
          <div className="orgs-waiting">
            <BrandMark label={t('orgsLoading')} />
          </div>
        ) : organizations.length === 0 ? (
          !message && <div className="orgs-note">{t('orgsEmpty')}</div>
        ) : (
          <>
            <input
              type="search"
              className="orgs-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('orgsSearchPlaceholder')}
              aria-label={t('orgsSearch')}
            />
            {visible.length === 0 ? (
              <div className="orgs-note">{t('orgsNoMatch')}</div>
            ) : (
              <div className="orgs-list">
                {visible.map((org) => {
                  const isCurrent = org.key === current;
                  const isDefault = org.key === preferred;
                  return (
                    <div
                      key={org.key}
                      className={isCurrent ? 'orgs-row current' : 'orgs-row'}
                    >
                      <div className="orgs-main">
                        <div className="orgs-nameline">
                          {isCurrent ? (
                            <p className="orgs-name">{org.name}</p>
                          ) : (
                            <button
                              type="button"
                              className="orgs-name as-button"
                              onClick={() => onPick(org.key)}
                              aria-label={t('orgsSignInTo', org.name)}
                            >
                              {org.name}
                            </button>
                          )}
                          {isCurrent && (
                            <span className="orgs-badge current">
                              {t('orgsCurrent')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="orgs-key"
                          onClick={() => copyKey(org.key)}
                          title={t('orgsCopyKey')}
                          aria-label={t('orgsCopyKeyFor', org.key)}
                        >
                          <span>{org.key}</span>
                          <span className="orgs-copied" aria-hidden="true">
                            {copiedKey === org.key ? '✓' : '⧉'}
                          </span>
                        </button>
                      </div>
                      <div className="orgs-actions">
                        {isDefault ? (
                          <span className="orgs-badge default">
                            {t('orgsDefault')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="orgs-setdefault"
                            onClick={() => void setDefault(org.key)}
                            disabled={savingKey !== null}
                            aria-label={t('orgsSetDefaultFor', org.name)}
                          >
                            {savingKey === org.key
                              ? t('orgsSettingDefault')
                              : t('orgsSetDefault')}
                          </button>
                        )}
                        {org.isAdmin && (
                          <span className="orgs-badge admin">
                            {t('orgsAdmin')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
