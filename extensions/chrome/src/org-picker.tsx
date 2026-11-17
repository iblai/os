import { useEffect, useRef, useState } from 'react';
import { t } from './i18n';
import {
  listOrganizations,
  NoSessionError,
  setDefaultOrganization,
  type Organization,
} from './organizations';

interface OrgPickerProps {
  /** The one the panel is in now, marked in the list and not offered again. */
  current: string | null;
  onPick: (key: string) => void;
  onCancel: () => void;
  /** Set when a pick could not be started, so the person is not left guessing. */
  notice?: string | null;
  /** A switch is under way: the rows stop taking clicks until it lands. */
  switching?: boolean;
}

/**
 * Pick an organization, in the panel.
 *
 * Choosing one is the whole point of the screen, so the row itself is the
 * control — no Select button beside a name. Making one the default is a
 * different decision and gets its own control, which is why the two are not
 * the same click.
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
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Read through a ref so the effect below can run once. Keyed on `onCancel`
  // it re-ran on every parent render and pulled focus back to the × button,
  // off whatever row the person had arrowed to.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // It covers the chat, so it has to behave like a dialog: the keyboard starts
  // inside it, and Escape leaves. Without this, focus stays in the chat behind
  // an opaque overlay.
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      cancelRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // A new switch makes an older save failure stale: leaving it up would hide
  // the panel's message about the switch itself.
  useEffect(() => {
    if (switching) setError(null);
  }, [switching]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      setError(null);
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
  }, []);

  const makeDefault = async (key: string) => {
    setSaving(true);
    // Shown as chosen straight away: the request is a save, and bouncing the
    // mark back on failure says more than a spinner would.
    const previous = preferred;
    setPreferred(key);
    try {
      await setDefaultOrganization(key);
      // A later success must clear an earlier failure's message.
      setError(null);
    } catch (err) {
      console.error('[ibl.ai panel] could not save the default:', err);
      setPreferred(previous);
      setError(t('defaultOrgFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Whichever message is current wins. The picker's own error is the more
  // specific of the two, but it survives until a later successful save — so a
  // switch starting clears it (below), and a notice from the panel about that
  // switch is then the only one left to show.
  const message = error ?? notice;

  return (
    <div
      className="orgs"
      role="dialog"
      aria-modal="true"
      aria-label={t('orgsTitle')}
    >
      <div className="orgs-head">
        <span className="orgs-title">{t('orgsTitle')}</span>
        <button
          ref={closeRef}
          type="button"
          className="orgs-close"
          onClick={onCancel}
          title={t('orgsClose')}
          aria-label={t('orgsClose')}
        >
          ×
        </button>
      </div>

      {message && <div className="row-error">{message}</div>}

      {switching ? (
        <div className="orgs-note">{t('orgsSwitching')}</div>
      ) : organizations === null ? (
        <div className="orgs-note">{t('orgsLoading')}</div>
      ) : organizations.length === 0 ? (
        !message && <div className="orgs-note">{t('orgsEmpty')}</div>
      ) : (
        <ul className="orgs-list">
          {organizations.map((org) => {
            const isCurrent = org.key === current;
            const isDefault = org.key === preferred;
            return (
              <li key={org.key} className="orgs-row">
                <button
                  type="button"
                  className="orgs-name"
                  onClick={() => !isCurrent && onPick(org.key)}
                  disabled={isCurrent || switching}
                  aria-current={isCurrent || undefined}
                >
                  <span className="orgs-label">{org.name}</span>
                  <span className="orgs-marks">
                    {isCurrent && (
                      <span className="orgs-badge">{t('orgsCurrent')}</span>
                    )}
                    {/* The default reads as a word, not a disabled icon whose
                        only explanation would be a tooltip that never shows. */}
                    {isDefault && (
                      <span className="orgs-badge">{t('orgsDefault')}</span>
                    )}
                  </span>
                </button>
                {/* Offered only where it would do something, so no row carries
                    a control that cannot be used. */}
                {!isDefault && (
                  <button
                    type="button"
                    className="orgs-star"
                    onClick={() => void makeDefault(org.key)}
                    disabled={saving || switching}
                    title={t('orgsMakeDefault')}
                    aria-label={`${t('orgsMakeDefault')}: ${org.name}`}
                  >
                    ★
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
