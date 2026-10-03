'use client';

import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supportedLocales, type SupportedLocale } from '../../locales';

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    try {
      await setLocale(event.target.value as SupportedLocale);
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
      <span className="status-text">{t('profile.languageHelp')}</span>
    </div>
  );
}
