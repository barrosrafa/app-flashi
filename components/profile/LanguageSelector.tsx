'use client';

import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supportedLocales, type SupportedLocale } from '../../locales';

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSaveError(false);
    setSaving(true);
    try {
      await setLocale(event.target.value as SupportedLocale);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor="language-select">{t('common.language')}</label>
      <select id="language-select" value={locale} disabled={saving} onChange={(event) => void handleChange(event)}>
        {supportedLocales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>{t(`languages.${supportedLocale}` as 'languages.pt-BR')}</option>
        ))}
      </select>
      <span className="status-text" role="status" aria-live="polite">
        {saving ? t('common.saving') : saveError ? t('profile.saveError') : t('profile.languageHelp')}
      </span>
    </div>
  );
}
