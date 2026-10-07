import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormField, FileUpload, Select, Textarea } from '../components/ui/FormField';
import { locales } from '../locales';

const flatten = (value: Record<string, unknown>, prefix = '', output: Record<string, string> = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') flatten(child as Record<string, unknown>, path, output);
    else output[path] = String(child);
  }
  return output;
};

const appShellSource = readFileSync(new URL('../components/AppShell.tsx', import.meta.url), 'utf8');
const socraticSource = readFileSync(new URL('../app/socratic/client-page.tsx', import.meta.url), 'utf8');

describe('F21 — contrato acessível de campos', () => {
  it('associa hint/erro ao controle e marca erro sem duplicar ids', () => {
    const markup = renderToStaticMarkup(
      <FormField id="email" label="E-mail" hint="Use o seu e-mail de acesso." error="Informe um e-mail válido.">
        <input id="email" type="email" />
      </FormField>,
    );
    expect(markup).toContain('for="email"');
    expect(markup).toContain('aria-describedby="email-hint email-error"');
    expect(markup).toContain('aria-errormessage="email-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="email-hint"');
    expect(markup).toContain('id="email-error"');
  });

  it('mantém os controles semânticos e força FileUpload a ser file', () => {
    expect(renderToStaticMarkup(<Select id="deck"><option value="one">One</option></Select>)).toContain('<select');
    expect(renderToStaticMarkup(<Textarea id="note" />)).toContain('<textarea');
    expect(renderToStaticMarkup(<FileUpload id="asset" accept="image/*" />)).toContain('type="file"');
  });
});

describe('F30/F31 — terminologia e traduções da shell/Socrático', () => {
  it('mantém as mesmas chaves completas em PT-BR, EN e ES', () => {
    const pt = flatten(locales['pt-BR'] as unknown as Record<string, unknown>);
    const en = flatten(locales.en as unknown as Record<string, unknown>);
    const es = flatten(locales.es as unknown as Record<string, unknown>);
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    expect(Object.keys(es).sort()).toEqual(Object.keys(pt).sort());
    for (const key of ['nav.overview', 'nav.study', 'nav.decks', 'nav.createContent', 'nav.advancedMenu', 'socratic.title', 'socratic.emptyCycle']) {
      expect(pt[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
      expect(es[key]).toBeTruthy();
    }
  });
});

describe('F41 — ciclo Socrático orientado no empty state', () => {
  it('explica que o ciclo começa automaticamente e não oferece criação manual', () => {
    expect(socraticSource).toContain("t('socratic.emptyCycle')");
    expect(socraticSource).toContain("t('socratic.emptyDescription')");
    expect(socraticSource).not.toContain('/socratic/new');
  });
});

describe('F45 — hierarquia progressiva sem perda de acesso', () => {
  it('mantém os quatro destinos primários e um disclosure acessível para recursos', () => {
    expect(appShellSource).toContain("label: 'nav.overview'");
    expect(appShellSource).toContain("label: 'nav.study'");
    expect(appShellSource).toContain("label: 'nav.decks'");
    expect(appShellSource).toContain("label: 'nav.createContent'");
    expect(appShellSource).toContain('<details className="nav-advanced">');
    expect(appShellSource).toContain("t('nav.advancedMenuDescription')");
  });
});
