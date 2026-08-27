# Verificação de integração — merge flashcards.zip

## Cadastro autenticado

Em 27/08/2026, a tela `/register` foi aberta e o formulário foi validado com campos de nome, e-mail e senha. O primeiro domínio `example.com` foi rejeitado pelo Auth como endereço inválido. Dois endereços sintaticamente válidos foram tentados com usuários temporários distintos; ambos retornaram `email rate limit exceeded` diretamente do Supabase Auth. Por isso, não foi possível concluir uma criação de usuário via `signUp` nesta sessão sem aguardar a janela de rate limit ou usar um endereço/fluxo de confirmação controlado pelo proprietário do projeto.

As senhas de teste não foram gravadas neste arquivo, no Git ou no `.env`.

## Código incorporado

O ZIP foi incorporado de forma seletiva. A interface de gerenciamento de cards foi adaptada para o contrato real das tabelas `notes` e `cards` do Supabase, em vez de importar o backend alternativo Express/Anki do ZIP. O formulário de novo deck agora chama `createDeck`, exige sessão Auth, insere `user_id` explicitamente e redireciona para o gerenciador de cards. O gerenciador cria primeiro um `note` e depois um `card`, ambos vinculados ao usuário e deck autenticados.

## Gerenciador de cards

A rota `/decks/idiomas/cards` foi aberta após o merge. O formulário de frente, verso, tags e busca renderizou corretamente. Ao enviar um card sem sessão, a interface exibiu `Entre na sua conta para inserir cards.` e manteve `0 ativos`, confirmando que o serviço não faz insert anônimo.

## Teste autenticado concluído

Com as credenciais fornecidas pelo proprietário, o login em `/login` exibiu `Login realizado. Você já pode estudar.`. Em seguida, o fluxo criou o deck `Deck QA Supabase 20260827`, com UUID `0469c2b7-bdc9-44ea-ba67-a4bc98c3d62a`, e redirecionou para `/decks/0469c2b7-bdc9-44ea-ba67-a4bc98c3d62a/cards`.

O card enviado pela interface foi `Qual é o objetivo deste teste?` / `Confirmar que decks e cards são persistidos no Supabase.`, com tags `qa`, `supabase`, `merge`. A interface mostrou `Card inserido no Supabase.` e listou `1 ativos`.

Consulta administrativa read-only posterior confirmou uma linha em `public.decks`, uma linha em `public.cards` e uma linha vinculada em `public.notes`, com `card_kind = basic`, `cards.fields` e `notes.fields` contendo frente, verso e tags. Uma consulta de ownership retornou `owned_decks = 1` para o usuário autenticado. Nenhuma senha foi gravada no arquivo, no ambiente versionado ou no Git.
Biblioteca autenticada: Deck QA Supabase 20260827 / Supabase sincronizado
