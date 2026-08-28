# Auditoria crítica de UX/UI — App-Flashi

**Escopo.** A análise cobriu dashboard, shell de navegação, biblioteca e detalhe de decks, gerenciamento de cards, sessão de estudo, ferramentas avançadas, autenticação, perfil e manifesto PWA. O critério combinou as heurísticas de Nielsen [1], requisitos de foco/semântica da WCAG 2.2 [2] e recomendações de implementação do React [3].

## Diagnóstico executivo

O principal problema do produto não era uma falta de acabamento visual, mas a ausência de uma hierarquia operacional consistente: estados de carregamento, autenticação e sincronização pareciam equivalentes; a ação mais valiosa da sessão de estudo não tinha feedback de erro; a tela de ferramentas expunha quatro intenções diferentes no mesmo nível; e dois CTAs críticos não executavam porque os callbacks eram retornados sem chamada. Esses pontos elevavam a carga cognitiva e reduziam confiança justamente nos momentos de conversão para o hábito: entrar, criar conteúdo e revisar.

A intervenção priorizou a jornada de retorno ao estudo. O dashboard agora responde claramente “o que fazer em seguida”, decks vazios têm CTA contextual, a sessão impede avaliação antes da resposta e comunica falhas de persistência, e os formulários de autenticação/perfil têm labels, estados de processamento e feedback acessível. Também foram eliminadas inconsistências de nomenclatura e estilos que faziam a interface parecer menos confiável do que o backend real.

## Achados priorizados

| Prioridade | Evidência observada | Heurística / impacto de negócio | Decisão aplicada |
|---|---|---|---|
| P0 | `onClick={() => void optimize}`, `onClick={() => void savePreferences}` e `onClick={() => void signOut}` não chamavam as funções. | Prevenção de erros; perda direta de ativação e confiança. | Corrigidos para handlers executáveis; ações passaram a ter `type`, disabled durante processamento e feedback. |
| P0 | A sessão de estudo avançava apenas se o request fosse bem-sucedido, mas uma falha não era apresentada ao usuário. | Visibilidade do status do sistema; risco de repetição ou abandono. | Erro agora aparece como alerta recuperável, o cartão não avança e o CTA oferece retorno aos decks. |
| P1 | Dashboard exibido com traços, fila carregando e CTA “Começar sessão” mesmo em autenticação ausente. | Correspondência com o mundo real; conversão de entrada. | CTA muda para “Entrar para estudar” quando necessário; estados de dados e fila foram separados. |
| P1 | Sidebar usava caracteres Unicode como ícones, não tinha `aria-current`, skip link ou label de navegação. | Consistência, acessibilidade e orientação. | Ícones SVG decorativos, `<nav aria-label>`, `aria-current`, landmark principal e skip link. |
| P1 | Ferramentas reunia busca, ingestão, FSRS e Anki com linguagem técnica e ações sem estado de processamento. | Redução de carga cognitiva; descoberta de valor. | Blocos com intenção explícita, cópia orientada a resultado e estados busy/disabled. |
| P1 | Cards exibiam classes ausentes (`muted`, `table-wrap`, `link-button`) e tabela sem comportamento responsivo. | Consistência visual e prevenção de erro em mobile. | Tokens e classes foram implementados; tabela ganhou wrapper horizontal, caption e scopes. |
| P2 | Perfil repetia “Seu perfil” em `h1` e `h2`, dificultando navegação por headings. | Estrutura de conteúdo; navegação por leitor de tela. | Seção interna foi renomeada para “Preferências da conta”. |
| P2 | Detalhe de deck misturava visão geral, dados demonstrativos e CRUD de cards. | Arquitetura da informação; transparência de dados. | A amostra foi rotulada como “Amostra recente” e o caminho “Gerenciar cards” foi destacado. |

## Melhorias implementadas por área

### Shell e navegação

A shell recebeu landmarks semânticos, link “Pular para o conteúdo principal”, foco visível global, estado ativo anunciado por `aria-current="page"`, ícones SVG com `aria-hidden` e avatar acionável para o perfil. Em mobile, a navegação continua previsível e horizontalmente rolável, mantendo áreas de toque confortáveis sem depender de hover. Isso reduz o custo de orientação e evita que o usuário tenha de interpretar símbolos isolados.

### Dashboard e CRO

A tela inicial passou a começar por “Seu ritmo hoje”, seguida da “Próxima sessão” e só então a biblioteca. Essa ordem traduz o funil de retenção: entender o estado, iniciar a revisão e explorar conteúdo. O CTA da próxima sessão tem variações coerentes com o estado da conta, enquanto o estado vazio de decks conduz diretamente a “Criar meu primeiro deck”. Barras de progresso agora possuem `role="progressbar"`, valores e rótulos úteis para tecnologias assistivas.

### Estudo

A ação de revelar ficou explícita e o teclado é tratado como aceleração, não como requisito oculto: Espaço revela e 1–4 avaliam somente depois da revelação. O componente informa “Salvando sua avaliação…”, desabilita avaliações concorrentes e mantém o cartão atual quando a persistência falha. A sessão vazia possui CTA de gerenciamento, tornando o bloqueio um próximo passo em vez de uma tela morta.

### Formulários e conta

Login, cadastro e perfil agora usam labels associadas por `htmlFor`/`id`, `autocomplete`, `aria-live`, estados de carregamento e prevenção de duplo envio. O cadastro informa a regra mínima da senha no contexto do campo; o login diferencia feedback de progresso, erro e sucesso. O perfil usa `<form onSubmit>` e os botões finalmente executam suas funções.

### Ferramentas e gerenciamento de conteúdo

A tela de ferramentas foi reorganizada por intenção: encontrar conteúdo, transformar fonte, personalizar revisão e migrar Anki. O bug do FSRS foi corrigido, a importação limpa o input após uso e exportações mostram estado de preparação. O gerenciamento de cards ganhou busca com cópia mais clara, tabela responsiva, caption, `scope="col"`, estado vazio contextual e ação “Arquivar” com feedback.

### SEO, PWA e base visual

O layout recebeu título template, descrição, application name, keywords, manifest e Open Graph. O manifesto agora declara idioma, categorias, branding e atalhos para estudar e abrir decks. A base visual recebeu tokens de cor, contraste melhorado para textos secundários, estados de foco, `prefers-reduced-motion`, sizing mínimo de controles e estilos ausentes que antes causavam inconsistência. Como as áreas principais são autenticadas, SEO deve ser entendido como descoberta da marca, compartilhamento e instalação; não como indexação de conteúdo privado.

## Riscos e mitigação

| Melhoria | Risco de implementação | Mitigação aplicada / recomendada |
|---|---|---|
| CTA contextual de autenticação | Usuários recorrentes podem estranhar a troca de texto entre estados. | A ação mantém a mesma posição visual e a mudança ocorre apenas quando o sistema identifica autenticação ausente. |
| Navegação mobile horizontal | Usuários podem não perceber itens fora da viewport. | Manter no máximo sete áreas, preservar ordem, usar scrollbar discreta e avaliar futuramente uma navegação móvel dedicada com até cinco itens prioritários. |
| Feedback e bloqueio durante requests | Desabilitar ações pode parecer travamento se a API for lenta. | Texto do botão muda para verbo progressivo; próximo passo recomendado é adicionar timeout visual e retry. |
| Rotulagem da amostra do deck | Ainda há risco de o usuário interpretar métricas e cards demonstrativos como dados reais. | A amostra foi explicitamente identificada; a próxima evolução deve substituir números hardcoded por serviço de detalhe real. |
| Alteração de nomenclatura do botão de cards | Integrações externas ou testes antigos podem depender do texto anterior. | A suíte E2E foi atualizada; consumidores externos devem preferir roles/labels estáveis em vez de texto de apresentação. |
| Atalhos PWA | Sem arquivos de ícone reais, a instalação ainda não tem branding completo. | Atalhos foram adicionados sem inventar assets; providenciar ícones 192/512px antes de promover a instalação como benefício de aquisição. |

## Validação realizada

A validação técnica foi executada com `pnpm typecheck`, `pnpm test` e `pnpm build`, todos concluídos com sucesso. A suíte E2E final passou com **15 cenários**, mantendo **1 cenário autenticado opcionalmente ignorado** por ausência de `E2E_EMAIL` e `E2E_PASSWORD`; portanto, mutações reais no Supabase não foram simuladas com credenciais do usuário.

Também foi executado um smoke test dedicado que visitou todas as rotas principais, percorreu links internos e acionou botões visíveis em estado não autenticado. Não foram encontrados erros de JavaScript. A matriz abaixo resume a cobertura manual automatizada realizada:

| Área | Rotas verificadas | Resultado |
|---|---|---|
| Entrada e aquisição | `/login`, `/register` | Renderização, labels, submit sem dados e links cruzados verificados. |
| Retenção | `/`, `/study/idiomas` | CTA, estados vazios/carregamento, progresso e navegação verificados. |
| Conteúdo | `/decks`, `/decks/new`, `/decks/idiomas`, `/decks/idiomas/cards` | Links, formulário, busca, tabela e estados vazios verificados. |
| Planejamento e análise | `/exams`, `/analytics` | Renderização e controles visíveis verificados. |
| Conta e operações | `/profile`, `/tools` | Botões de salvar/sair, busca, otimização, importação/exportação e feedback verificados em modo não autenticado. |
| Offline/PWA | service worker e navegação offline em `/decks` | Passou na suíte E2E. |

## Pendências estratégicas

A prioridade seguinte é remover os números e cards demonstrativos do detalhe do deck e conectá-los a um serviço de dados real, pois transparência de conteúdo é mais importante para confiança do que o acabamento visual. Em paralelo, vale testar com usuários a nomenclatura “De novo / Difícil / Bom / Fácil”, medir início de sessão, conclusão de sessão e criação do primeiro deck, e fornecer ícones reais no manifesto PWA. O teste autenticado contra o Supabase deve ser executado em ambiente com credenciais E2E dedicadas e dados descartáveis.

## Referências

[1]: https://www.nngroup.com/articles/ten-usability-heuristics/ "Nielsen Norman Group — 10 Usability Heuristics for User Interface Design"
[2]: https://www.w3.org/TR/WCAG22/ "W3C — Web Content Accessibility Guidelines (WCAG) 2.2"
[3]: https://react.dev/reference/react-dom/components "React — Built-in HTML components"
