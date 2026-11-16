import { useEffect, useState } from 'react';
import { t } from './i18n';
import {
  defaultOrganization,
  listOrganizations,
  setDefaultOrganization,
  type Organization,
} from './organizations';

interface OrgPickerProps {
  /** The one the panel is in now, marked in the list and not offered again. */
  current: string | null;
  onPick: (key: string) => void;
  onCancel: () => void;
}

/**
 * Pick an organization, in the panel.
 *
 * Choosing one is the whole point of the screen, so the row itself is the
 * control — no Select button beside a name. Making one the default is a
 * different decision and gets its own icon, which is why the two are not the
 * same click.
 */
export function OrgPicker({ current, onPick, onCancel }: OrgPickerProps) {
  const [organizations, setOrganizations] = useState<Organization[] | null>(
    null,
  );
  const [preferred, setPreferred] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      setError(null);
      try {
        const [list, fallback] = await Promise.all([
          listOrganizations(),
          defaultOrganization(),
        ]);
        if (!live) return;
        setOrganizations(list);
        setPreferred(fallback);
      } catch (err) {
        console.error('[ibl.ai panel] could not list organizations:', err);
        if (!live) return;
        setError(t('orgsFailed'));
        setOrganizations([]);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  const makeDefault = async (key: string) => {
    setSaving(key);
    // Shown as chosen straight away: the request is a save, and bouncing the
    // mark back on failure says more than a spinner would.
    const previous = preferred;
    setPreferred(key);
    try {
      await setDefaultOrganization(key);
    } catch (err) {
      console.error('[ibl.ai panel] could not save the default:', err);
      setPreferred(previous);
      setError(t('defaultOrgFailed'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="orgs" role="group" aria-label={t('orgsTitle')}>
      <div className="orgs-head">
        <span className="orgs-title">{t('orgsTitle')}</span>
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

      {error && <div className="row-error">{error}</div>}

      {organizations === null ? (
        <div className="orgs-note">{t('orgsLoading')}</div>
      ) : organizations.length === 0 ? (
        !error && <div className="orgs-note">{t('orgsEmpty')}</div>
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
                  disabled={isCurrent}
                  aria-current={isCurrent || undefined}
                >
                  <span className="orgs-label">{org.name}</span>
                  {isCurrent && (
                    <span className="orgs-badge">{t('orgsCurrent')}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={isDefault ? 'orgs-star on' : 'orgs-star'}
                  onClick={() => void makeDefault(org.key)}
                  disabled={isDefault || saving !== null}
                  title={isDefault ? t('orgsIsDefault') : t('orgsMakeDefault')}
                  aria-label={
                    isDefault
                      ? t('orgsIsDefault')
                      : `${t('orgsMakeDefault')}: ${org.name}`
                  }
                  aria-pressed={isDefault}
                >
                  ★
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
