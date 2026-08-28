# Refatoração UX/UI da sessão de flashcards — Flashi

**Autor:** Manus AI  
**Escopo:** sessão de estudo `/study/[deckId]`, incluindo estado frente, verso, avaliação, conclusão, modo foco/claro, teclado, mobile e integração com a fila real.

## 1. Diagnóstico crítico

A interface anterior já possuía a mecânica básica de revelar e avaliar, mas colocava todos os elementos no mesmo nível visual: a contagem, a pergunta, o estado do card, o botão de revelar e as avaliações não formavam uma sequência perceptível. Para uma tarefa de Active Recall, essa ausência de sequência é um gargalo porque o usuário precisa lembrar antes de ver a resposta; qualquer ruído ou ambiguidade na tela reduz a qualidade do esforço cognitivo.

Os três principais gargalos encontrados foram:

| Gargalo | Por que prejudica a experiência | Severidade |
|---|---|---|
| **Hierarquia insuficiente entre pergunta e resposta** | A pergunta e a resposta usavam o mesmo card genérico, sem uma moldura forte de “pergunta primeiro, resposta depois”. O usuário tinha pouca sinalização sobre em que etapa da revisão estava. | Alta |
| **Avaliações pouco orientadas à decisão** | Os botões tinham rótulos e intervalos, porém sem uma pergunta explícita (“Como foi sua lembrança?”), sem separação de contexto e sem uma barra de ações visualmente ancorada. | Alta |
| **Foco e ergonomia incompletos** | Não havia modo de concentração, o progresso era discreto e o uso de teclado não deixava claro quando Espaço significava revelar ou confirmar. Em mobile, a ação precisava permanecer confortável sem criar competição visual. | Média/alta |

Também havia um problema de confiança operacional: o estado de persistência não era suficientemente comunicado na própria sessão. A nova implementação diferencia “Salvando sua avaliação…”, “Avaliação salva” e “Avaliação salva localmente e aguardando sincronização”, alinhando a visibilidade do sistema à arquitetura local-first do produto.

## 2. Benchmarking com concorrentes

O benchmark não foi tratado como cópia visual. Foram incorporados padrões de interação e comunicação comprovados nas referências oficiais de Anki, Quizlet e RemNote, adaptados ao contexto visual do Flashi.

| Referência | Padrão observado | Incorporação no Flashi | Motivo |
|---|---|---|---|
| **Anki** | Avaliações aparecem depois da resposta; cada opção mostra o próximo intervalo e possui atalho de teclado. [1] | O painel de avaliação só aparece após “Revelar resposta”; cada botão informa intervalo, tecla 1–4 e nome sem depender apenas de cor. | Reduz avaliação acidental e melhora a precisão do feedback para o algoritmo. |
| **Quizlet** | Fluxo simples: estudar, avaliar e voltar no momento certo; a agenda é comunicada como automação que reduz configuração. [2] | A interface evita configurações durante a revisão e explica que a honestidade define o próximo intervalo. | Mantém a sessão orientada a hábito e reduz carga cognitiva operacional. |
| **RemNote** | A repetição espaçada é apresentada como uma experiência acessível e simplificada, conectada à criação/revisão de cards. [3] | A pergunta e a resposta usam linguagem direta, com estado “Novo” e CTA de retorno aos decks quando não há cards. | Torna o sistema compreensível sem exigir conhecimento prévio de SRS. |
| **Profile / OroSwap** | Profile usa superfície escura premium, headline forte e produto em foco; OroSwap demonstra sequências de estado e feedback de confirmação. [4] [5] | O modo foco usa superfície escura contida, progresso no topo e feedback de conclusão/sincronização. | Aproveita contraste, prova de estado e sensação de produto sem importar animações ou neon que distrairiam da memorização. |

## 3. Nova estrutura de layout — wireframe textual

A tela usa um fluxo vertical previsível. No topo permanece a shell do produto com navegação e título da página. Logo abaixo, uma barra curta contém “← Meus decks” à esquerda e o alternador “Modo claro/M modo foco” à direita; essa ação é auxiliar e não compete com o CTA de estudo.

A área de estudo começa com o progresso: um eyebrow “Sessão em andamento”, o contador “1 de 10” e o percentual concluído. A barra horizontal de seis pixels fica imediatamente abaixo, com `role="progressbar"`, `aria-valuenow`, `aria-valuemin` e `aria-valuemax`.

O card central é o elemento dominante. Ele possui largura máxima de 820px, margens generosas, raio de 16px e sombra sutil. No topo do card, “Pergunta” fica à esquerda e o estado “Novo” à direita. A pergunta aparece centralizada em uma medida confortável, com headline responsiva entre aproximadamente 30px e 48px. Antes da resposta, existe apenas um CTA primário “Revelar resposta” acompanhado da tecla `Espaço`.

Após a revelação, a resposta surge abaixo de um divisor, com o rótulo “Resposta” e uma medida de texto maior para leitura. Somente então aparece o painel de avaliação, com o título “Como foi sua lembrança?”, helper text e a indicação “1–4 ou Espaço = avaliar”. Os quatro botões possuem área mínima confortável, tecla, rótulo e próximo intervalo. Em desktop, ficam em uma linha; em mobile, formam uma grade 2×2. O painel usa `position: sticky` com margem inferior para manter a decisão acessível sem ocultar o conteúdo.

> **Sequência cognitiva:** progresso → pergunta → esforço de lembrança → revelar → comparar → avaliar → feedback de persistência → próxima pergunta.

## 4. Especificações de design system

### Paleta

A paleta separa superfície, ação e feedback sem usar cor como único canal semântico. O modo foco usa fundo `#0e1320`/`#171c2a`, superfície `#1a2130`, texto principal `#f8fafc` e texto secundário `#aab4c6`. O gradiente de progresso usa roxo `#7c72ff` e verde suave `#8de0bf`. Para avaliações, os tons são dessaturados: erro `#ffb4aa`, dúvida `#f4cf83`, acerto `#8de0bf` e facilidade `#9ecbff`. Esses estados permanecem acompanhados pelos textos “De novo”, “Difícil”, “Bom” e “Fácil”.

No modo claro, as superfícies são `#f6f7fb` e `#ffffff`, com texto principal `#17202a`, texto secundário `#5f6b7a`, ação primária `#5146e5` e foco `#8b5cf6`. Divisores usam `#dfe3ec`. O contraste de textos normais deve permanecer no mínimo em 4,5:1, conforme a orientação de acessibilidade da WCAG 2.2. [6]

### Tipografia

A aplicação mantém **Space Grotesk** para títulos e contadores, e **DM Sans** para corpo, labels e helper text. A pergunta usa `clamp(30px, 5vw, 48px)`, line-height de `1.16` e largura máxima de 680px. A resposta usa `clamp(18px, 2vw, 23px)` e line-height de `1.55`. Labels auxiliares permanecem em 11–13px, mas não carregam o conteúdo principal.

### Espaçamento e interação

O sistema preserva ritmo baseado em 4/8px: padding do card entre 24px e 76px conforme o viewport, gaps de 8px/14px/18px, e margem de 16px entre card e ações. Controles principais têm ao menos 44px de altura, incluindo alternador de tema, avatar, CTA, link de retorno e avaliações. Estados `hover`, `active`, `focus-visible` e `disabled` não alteram os limites do layout. `prefers-reduced-motion: reduce` reduz transições e remove dependência de movimento.

## 5. Código de implementação

A implementação está em `app/study/[deckId]/page.tsx` e `app/globals.css`. O núcleo do estado frente/verso é:

```tsx
<article className="card study-card study-card-refined" aria-live="polite">
  <div className="study-card-top">
    <span className="study-type">Pergunta</span>
    <span className="pill">{current.state === 'new' ? 'Novo' : current.state}</span>
  </div>

  <div className="study-prompt">
    <h2 id="study-card-title">{currentContent.front}</h2>
  </div>

  {revealed ? (
    <div className="study-answer">
      <div className="study-answer-label">Resposta</div>
      <p>{currentContent.back}</p>
    </div>
  ) : (
    <button
      className="btn reveal-button"
      type="button"
      onClick={() => setRevealed(true)}
      aria-keyshortcuts="Space"
    >
      <span>Revelar resposta</span>
      <kbd>Espaço</kbd>
    </button>
  )}
</article>
```

As avaliações são renderizadas após a revelação e possuem semântica explícita:

```tsx
<div className="ratings">
  {ratings.map((rating, index) => (
    <button
      className={`rating rating-refined ${rating.tone}`}
      type="button"
      disabled={pending}
      aria-keyshortcuts={String(index + 1)}
      aria-label={`${rating.label}, próxima revisão ${rating.hint}`}
      onClick={() => void rate(rating.key)}
    >
      <span className="rating-key" aria-hidden="true">{index + 1}</span>
      <span className="rating-label">{rating.label}</span>
      <small>{rating.hint}</small>
    </button>
  ))}
</div>
```

Também foi adicionada a rota `/study/demo`, que usa um card demonstrativo sem tocar no serviço real. Isso permite revisar a interface e testar o funil frente/verso sem exigir login ou dados reais.

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| O modo escuro pode aumentar fadiga para parte dos usuários. | O estado inicial é modo foco, mas o usuário pode alternar para modo claro com `aria-pressed` e texto explícito. |
| Quatro avaliações podem gerar indecisão em iniciantes. | Cada opção mostra significado e intervalo; a próxima evolução pode oferecer preferência Again/Good, padrão aceito pelo Anki. [1] |
| `position: sticky` pode sobrepor conteúdo em telas muito pequenas. | A barra tem insets, permanece após o card e muda para grade 2×2 no breakpoint de 680px; smoke test verifica overflow. |
| O card demo pode ser confundido com conteúdo persistido. | A página identifica “Prévia interativa do fluxo de revisão” no subtítulo e usa `deckId === 'demo'` apenas como fixture. |
| A persistência local pode dar falsa sensação de sincronização imediata. | O status diferencia “salva localmente” de “salva”; a arquitetura de outbox continua responsável pela sincronização. |
| Atalhos globais podem conflitar com controles focáveis. | O handler ignora `input`, `textarea`, elementos editáveis, links e botões nativos; Espaço no botão de tema continua alternando o tema de forma previsível. |

## 7. Testes executados

A qualidade foi validada em camadas. `pnpm typecheck`, `pnpm test` e `pnpm build` foram executados com sucesso. A suíte Playwright passou com **17 cenários**, com **1 cenário autenticado opcional ignorado** por ausência de credenciais E2E; não foram executadas mutações reais em conta de usuário.

O smoke test `scripts/ui-smoke.mjs` foi ampliado para as 13 rotas da aplicação em três viewports: desktop 1280×900, tablet 768×1024 e mobile 375×812. Ele percorre links internos, aciona botões visíveis, verifica ausência de overflow horizontal, testa dimensões mínimas de controles e executa com `prefers-reduced-motion: reduce`. A rodada final concluiu sem erros de JavaScript, overflow ou botões abaixo do limite configurado.

A validação visual da rota `/study/demo` cobriu estado frente, revelação, estado verso, avaliações, conclusão, alternância modo foco/modo claro e comportamento de teclado. Os achados estão registrados em `docs/reference-benchmark-notes.md`.

## Referências

[1]: https://docs.ankiweb.net/studying.html "Anki Manual — Studying"
[2]: https://quizlet.com/features/spaced-repetition "Quizlet — Spaced Repetition"
[3]: https://help.remnote.com/en/articles/6022755-getting-started-with-spaced-repetition "RemNote Help Center — Getting Started with Spaced Repetition"
[4]: https://profilebehavior.com/ "Profile — Behavioral Assessments for Elite Teams"
[5]: https://www.oroswap.org/ "OroSwap — The First AI-Powered DEX on ZIGChain"
[6]: https://www.w3.org/TR/WCAG22/ "W3C — Web Content Accessibility Guidelines (WCAG) 2.2"
