
## Validação visual da implementação — estado frente

A prévia `/study/demo` renderizou sem erro depois de uma configuração local mínima. O modo foco cria uma superfície escura contida, com sidebar preservada, título e CTA de retorno no topo, progresso “1 de 1” acima do card, pergunta centralizada e botão “Revelar resposta” com tecla visível. A área de conteúdo tem margens generosas e o card não compete com a navegação. O painel ocupa altura suficiente para manter o foco sem empurrar a ação para fora da viewport desktop.

## Validação visual da implementação — estado verso e conclusão

Ao revelar, a resposta foi separada por divisor e rótulo, com leitura confortável. O painel de avaliação apareceu somente após a resposta, com quatro escolhas textuais, próxima revisão visível e teclas 1–4, seguindo o padrão do Anki. A avaliação “Bom” concluiu a prévia e mostrou feedback de conclusão com retorno ao início; a gravação local foi resiliente mesmo sem credencial válida.

## Validação visual da implementação — temas

O modo claro preservou a hierarquia: fundo neutro, card branco, headline escuro, CTA primário roxo e progresso acima do conteúdo. A troca é reversível e anunciada pelo texto do botão (“Modo foco”/“Modo claro”) e por `aria-pressed`. O modo foco mostrou contraste mais expressivo e reduz a competição visual entre navegação e conteúdo, enquanto o modo claro funciona como alternativa de conforto para leitura prolongada.

## Validação de teclado

O teste confirmou a regra de escopo: quando o foco permanece no botão de tema, Espaço aciona o controle nativo em vez de revelar o card; o handler global ignora links e botões para evitar ação concorrente. Ao mover o foco para o conteúdo, o atalho pode ser usado sem mouse. Essa decisão é intencional e mantém a previsibilidade de controles nativos.
