# Instruções de deploy — GitNotification

## Importante antes de publicar

O GitNotification é uma aplicação Express com interface Vite, API própria, varredor agendado e dados guardados num ficheiro JSON. **A configuração Vite padrão do Vercel não executa este backend como um serviço persistente.** Um deploy apenas como site Vite pode mostrar a página, mas as rotas `/api/...` e a monitorização automática não funcionarão.

Além disso, a aplicação ainda não tem autenticação. A rota `/api/status` devolve configurações de integração, incluindo credenciais. **Não exponha o serviço à Internet nem configure tokens reais até proteger a aplicação com autenticação ou controlo de acesso.**

Para executar a aplicação completa, este guia usa o Railway, que mantém o servidor Express em execução e permite guardar os dados num volume persistente.

## O erro “Failed to fetch” no ecrã do Vercel

Na imagem, o erro aparece no campo **Project Name**. Experimente um nome único em minúsculas, por exemplo `gitnotification-nicolemos56-2026`. Se o erro continuar:

1. Atualize a página de importação e tente novamente.
2. Em **Vercel → Settings → Git**, confirme ou volte a autorizar a integração GitHub.
3. Confirme que a branch `main` está disponível na conta GitHub ligada ao Vercel.

Mesmo que a importação passe, não conclua um deploy como Vite estático: isso não disponibiliza o backend deste projeto.

## Preparar a versão

1. Confirme que o GitHub contém a versão mais recente de `server.ts`, `package.json` e deste guia na branch `main`. Alterações que existam apenas no computador não são enviadas automaticamente ao GitHub.
2. Confirme que `.env` e `gitpulse_db.json` **não** estão no GitHub. O `.gitignore` do projeto exclui estes ficheiros; o `.env.example` contém apenas valores de exemplo.
3. Na raiz do projeto, valide a compilação:

   ```bash
   npm install
   npm run lint
   npm run build
   ```

## Deploy no Railway

1. Crie ou abra um projeto no [Railway](https://railway.com/).
2. Escolha **New Project → Deploy from GitHub repo** e selecione `nicolemos56/GitNotification`, branch `main`.
3. Configure o serviço com:
   - **Root Directory:** `/`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
4. Adicione um **Volume** ao serviço, com o caminho de montagem `/data`.
5. Em **Variables**, configure:
   - `Groq_API_KEY` — a chave Groq, inserida como segredo no painel do Railway. Não a coloque no repositório.
   - `DATA_DIR=/data` — guarda `gitpulse_db.json` no volume persistente.
   - `PORT` — deixe o Railway atribuir esta variável automaticamente.
6. Faça o deploy e confirme nos logs que o servidor iniciou sem erros.
7. Só depois de configurar autenticação/controlo de acesso, gere um domínio público em **Settings → Networking → Generate Domain**.
8. Abra o domínio. A interface deve carregar; depois configure GitHub e o canal de notificações pelo assistente.

O comando `npm start` executa `node dist/server.cjs`. O servidor usa a porta fornecida pelo Railway (ou `3000` em desenvolvimento) e guarda os dados no diretório indicado por `DATA_DIR`.

## Verificação depois do deploy

- Abra a página inicial e confirme que o assistente ou dashboard aparece.
- Consulte `/api/status` apenas para confirmar que responde; **não partilhe nem publique o conteúdo da resposta**, pois inclui configurações de integração.
- Verifique os logs do Railway para erros de arranque ou de acesso ao volume.
- Faça a primeira varredura manual somente depois de adicionar as credenciais necessárias. Ela pode contactar GitHub, Groq e o canal de notificações configurado.
- Ative a monitorização contínua apenas se quiser verificações automáticas a cada 15 minutos. O serviço precisa continuar ligado.

## Segurança e persistência

- O repositório deve conter apenas código e exemplos. Nunca envie `.env`, `gitpulse_db.json`, tokens do Telegram/Twilio/GitHub ou chaves Groq.
- A aplicação é atualmente de utilizador único e não protege as rotas com login. Se já publicou credenciais num repositório público, revogue-as e crie novas.
- O volume `/data` mantém configurações entre novos deploys. Sem o volume e `DATA_DIR=/data`, os dados guardados podem desaparecer quando o serviço for recriado.
- Para disponibilizar o dashboard publicamente, implemente primeiro autenticação que proteja a interface e todas as rotas `/api`.
