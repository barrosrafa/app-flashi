'use client';

import { useTheme, type Theme } from '../lib/theme/ThemeProvider';

type ThemeOption = { value: Theme; label: string; description: string; icon: 'sun' | 'moon' | 'system' };
const options: ThemeOption[] = [
  { value: 'light', label: 'Claro', description: 'Superfícies claras', icon: 'sun' },
  { value: 'dark', label: 'Escuro', description: 'Baixa luminosidade', icon: 'moon' },
  { value: 'system', label: 'Sistema', description: 'Preferência do dispositivo', icon: 'system' },
];

function ThemeIcon({ name }: { name: ThemeOption['icon'] }) {
  if (name === 'sun') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
  if (name === 'moon') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.6A8.5 8.5 0 0 1 8.4 3.5 8.5 8.5 0 1 0 20.5 15.6Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>;
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <fieldset className="theme-switcher">
      <legend className="sr-only">Tema da interface</legend>
      {options.map((option) => (
        <label key={option.value} className={`theme-option${theme === option.value ? ' active' : ''}`}>
          <input
            type="radio"
            name="interface-theme"
            value={option.value}
            checked={theme === option.value}
            onChange={() => setTheme(option.value)}
          />
          <span className="theme-option-icon"><ThemeIcon name={option.icon} /></span>
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </label>
      ))}
    </fieldset>
  );
}
