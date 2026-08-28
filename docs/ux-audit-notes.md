# Auditoria UX/UI — notas de inspeção

## Linha de base renderizada

- A tela inicial renderiza com sidebar fixa em desktop e conteúdo principal deslocado.
- Em estado não autenticado, o aviso aparece como mensagem de status, mas o CTA primário ainda diz “Começar sessão” enquanto os indicadores carregam e a ação só aponta para `/decks`; falta um próximo passo explícito de autenticação.
- O avatar “R” não comunica conta nem é acionável.
- A navegação usa caracteres Unicode como ícones e não informa estado expandido, contexto da página ou área semântica.
- O rodapé da sidebar exibe “Modo local-first / Sincronização protegida”, mas o badge principal diz “Online · salvo localmente”; essa combinação pode sugerir sincronização online confirmada quando o usuário está deslogado.
- Cards de estatísticas mostram traços e “Carregando fila” sem indicador visual de carregamento além do texto.
- A área “Seus decks” fica sem estado vazio forte/CTA contextual quando a conta não fornece decks.
- A interface usa bastante texto em fonte pequena e não havia evidência de estilos de foco explícitos no CSS.

## Problemas de implementação observados

- `AppShell` contém toda a navegação em uma linha comprimida, sem `<main id>`, skip link, `aria-current`, rótulo da navegação ou semântica de botão para navegação móvel.
- `Topbar` sempre mostra o mesmo eyebrow e avatar estático.
- `globals.css` não define `:focus-visible`, `prefers-reduced-motion`, `aria`/status styles, `table-wrap` nem as classes usadas em alguns componentes (`muted`, `link-button`, `empty-state`).
- Detalhe de deck exibe números e cartões recentes hardcoded e mistura visão geral com o CRUD completo de cards.
- O CTA do detalhe usa `btn btn-secondary`, enquanto o CSS define `btn.secondary`.
- Tela de estudo permite avaliação por clique/teclado sem feedback de erro quando `submitReview` falha; o avanço pode parecer concluído sem confirmação visível.
- Tela de ferramentas concentra busca, ingestão, FSRS e Anki no mesmo nível visual, expõe linguagem técnica e tem um bug aparente: `onClick={() => void optimize}` não executa `optimize`.

## Direção de melhoria

1. Reforçar orientação e conversão na shell: skip link, navegação semântica, estado ativo, CTA contextual, header responsivo e status de sincronização mais honesto.
2. Melhorar legibilidade e feedback: tokens, foco visível, contraste, progress bars acessíveis, estados de carregamento/erro/vazio e mensagens inline.
3. Corrigir fluxo crítico de estudo: resposta primária clara, prevenção de avaliação antes de revelar, erro de review acionável, status ao vivo.
4. Corrigir tela de ferramentas: hierarquia, labels de ação, estados disabled/loading, execução do optimize e seções semanticamente distinguíveis.
5. Corrigir inconsistências de decks/cards: CTA secundário, tabela responsiva, classe de link, contentamento demonstrativo sinalizado e vazio acionável.
6. Adicionar metadados/SEO/PWA e documentação de riscos/mitigações.

## Referências internas verificadas

- Heurística de foco visível e navegação previsível: resultados da base local de UI/UX Pro Max em `/tmp/ux-focus.txt` e `/tmp/ux-nav.txt`.
- Formulários com labels associados, validação inline e resumo de erro: `/tmp/ux-forms.txt`.
- React: semântica HTML, gestão de foco e labels: `/tmp/react-guidance.txt`.

## Validação visual isolada

A rota `/decks/idiomas/cards` foi reaberta após reiniciar o servidor. A tela exibiu a shell com skip link, navegação rotulada, formulário de criação, busca e estado vazio acionável. O console mostrou apenas logs normais de React DevTools/HMR; o erro “Invalid or unexpected token” não se reproduziu fora da execução paralela do runner, sugerindo condição de processo/servidor durante o primeiro E2E. A segunda execução E2E, com navegador instalado, confirmou 13 de 15 cenários passando; os dois failures restantes eram seletores ambíguos de heading no perfil e o erro de runtime da rota de cards.
