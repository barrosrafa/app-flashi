'use client';

import { useTheme, type Theme } from '../lib/theme/ThemeProvider';

const options: Array<{ value: Theme; label: string; icon: string; description: string }> = [
  { value: 'light', label: 'Claro', icon: '☀', description: 'Superfícies claras' },
  { value: 'dark', label: 'Escuro', icon: '☾', description: 'Baixa luminosidade' },
  { value: 'system', label: 'Sistema', icon: '◐', description: 'Preferência do dispositivo' },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Tema da interface">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          className={`theme-option${theme === option.value ? ' active' : ''}`}
          onClick={() => setTheme(option.value)}
        >
          <span className="theme-option-icon" aria-hidden="true">{option.icon}</span>
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </button>
      ))}
    </div>
  );
}
