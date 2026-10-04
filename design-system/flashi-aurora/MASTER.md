# Sistema de design do Flashi

> Fonte de verdade para a interface atual. Mantemos a identidade índigo/violeta do produto; verde-menta é apenas um realce semântico. O sistema substitui a antiga especificação teal/orange, que já não correspondia à aplicação.

## Direção

- Produto de estudo: calmo, claro e orientado à próxima ação.
- Um objetivo principal por tela; configurações raras ficam em divulgação progressiva.
- Componentes partem de 320–390 px; tabelas viram cartões/listas quando houver espaço insuficiente.
- Gradientes e sombras são pontuais, não a estrutura visual padrão.
- Cantos e estados de foco consistentes; movimento respeita `prefers-reduced-motion`.

## Cores

Os tokens são definidos em `app/globals.css`, uma única vez para o modo claro e uma única vez em `[data-theme="dark"]`.

| Papel | Token | Claro | Escuro |
|---|---|---:|---:|
| Fundo | `--bg` | `#F8FAFC` | `#080B14` |
| Superfície | `--surface` | `#FFFFFF` | `#111827` |
| Texto principal | `--text-primary` | `#0F172A` | `#F8FAFC` |
| Texto secundário | `--text-secondary` | `#475569` | `#CBD5E1` |
| Texto auxiliar | `--text-muted` | `#64748B` | `#94A3B8` |
| Borda | `--border` | `#E2E8F0` | `#1E293B` |
| Ação principal | `--primary` | `#4F46E5` | `#818CF8` |
| Accent | `--accent` | `#8B5CF6` | `#A78BFA` |
| Sucesso | `--success` | `#047857` | `#34D399` |
| Alerta | `--warning` | `#9A6700` | `#FBBF24` |
| Erro | `--danger` | `#DC2626` | `#FB7185` |

`--ink`, `--muted`, `--line`, `--primary-dark`, `--primary-soft` e `--focus` são aliases para compatibilidade com componentes existentes; novos componentes devem preferir os tokens semânticos. Não comunicar estados somente pela cor.

## Tipografia e layout

- Corpo: DM Sans; títulos: Space Grotesk.
- Escala fluida com `clamp()` nos títulos e espaçamentos de seção.
- Breakpoints atuais priorizam 560 px (telefone), 800–900 px (tablet/layout) e 1000–1280 px (desktop).
- Container público: largura fluida com limite máximo; conteúdo do app respeita o espaço útil depois da navegação.
- Alvos interativos: mínimo 44 px; foco visível de 3 px; texto comum deve atingir contraste WCAG AA.

## Componentes

- **Primário:** preenchido por `--primary`, uma ação dominante por seção.
- **Secundário:** superfície tonal, preserva texto legível.
- **Card:** superfície e borda leves; elevação discreta, sem animação de salto obrigatória.
- **Estado:** aviso/sucesso/erro combinam ícone ou texto com cor.
- **Configuração avançada:** `<details>`/summary com nome claro e conteúdo não essencial.
- **Navegação mobile:** quatro destinos frequentes e uma entrada “Mais opções”; respeitar safe areas.

## Verificação ao alterar a interface

1. Testar 320, 375, 768 e 1280 px; verificar rolagem horizontal e foco não encoberto.
2. Conferir navegação por teclado, nomes acessíveis e estados de carregamento/erro/vazio.
3. Não apresentar IDs, JSON, bytes ou estados de backend quando houver um rótulo de tarefa em linguagem humana.
4. Validar contraste das combinações reais de texto/fundo, incluindo estados e tema escuro.
