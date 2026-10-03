# Sistema de temas do Flashi

## Estado

O Flashi suporta os temas **Claro**, **Escuro** e **Sistema**. A implementação segue o SDD de 03/10/2026 e mantém as classes existentes do design system Aurora, migrando cores e superfícies para tokens CSS.

## Arquitetura

- `lib/theme/ThemeProvider.tsx`: contexto client-side com `localStorage`, `prefers-color-scheme` e atualização reativa.
- `components/ThemeSwitcher.tsx`: radio group acessível com as três opções.
- `app/layout.tsx`: script inline antes da hidratação para evitar FOUC e `ThemeProvider` no shell da aplicação.
- `app/globals.css`: tokens light/dark em `:root` e `[data-theme="dark"]`, além dos estilos de componentes.
- `app/profile/page.tsx`: área **Aparência**, fora da Topbar, para trocar o tema.

## Comportamento

1. O script do layout lê `flashi-theme` antes da pintura da página.
2. `system` resolve a preferência com `matchMedia('(prefers-color-scheme: dark)')`.
3. A escolha é persistida em `localStorage`.
4. O atributo `data-theme` e `color-scheme` são atualizados no elemento `<html>`.
5. A opção Sistema reage a mudanças na preferência do dispositivo.

## Tokens principais

Os tokens incluem fundo, superfícies, textos, bordas, cores de marca, estados, gradientes, sombras, foco e raios. Componentes devem consumir `var(--token)`; valores inline devem ser reservados a dimensões calculadas, como progresso e gráficos.

## Validação manual

- Abrir `/profile`, selecionar Claro, recarregar e confirmar a persistência.
- Selecionar Escuro e navegar por `/`, `/decks`, `/study/demo`, `/analytics`, `/tools` e `/profile`.
- Selecionar Sistema e alternar a preferência de cor do navegador/SO.
- Usar Tab no seletor e confirmar foco visível e `aria-checked` correto.
- Executar `pnpm typecheck`, `pnpm test` e `pnpm test:e2e`.
