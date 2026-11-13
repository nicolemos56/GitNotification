# GitNotification 

**GitNotification**  é um monitor inteligente em tempo real que acompanha as atividades dos desenvolvedores que você segue no GitHub. Ele detecta repositórios criados nos últimos 30 dias, analisa os seus README com modelos de linguagem da Groq e envia relatórios e alertas diretamente para o seu **Telegram** ou **WhatsApp** (via Twilio).

---

##  Características Principais

-  **Monitorização do GitHub**: Sincronize e monitorize automaticamente todos os desenvolvedores que segue no GitHub com apenas um clique.
-  **Resumos com IA (Groq)**: Analisa o README com modelos de texto Groq, identifica objetivo, tecnologias documentadas e casos de uso, e tenta os modelos seguintes caso um falhe ou atinja o limite.
-  **Notificações Multicanal**:
  - **Telegram**: Alertas imediatos com formatação e links diretos para o GitHub.
  - **WhatsApp**: Encaminhamento nativo de mensagens diretas via plataforma Twilio.
-  **Varredura Ativa**: Verifica os repositórios públicos de cada desenvolvedor e considera apenas os criados nos últimos 30 dias, contornando limites de taxa com tokens pessoais opcionais.
-  **Consola de Eventos em Tempo Real**: Visualize a atividade e o fluxo de monitorização diretamente no ecrã com um histórico interativo da IA.
-  **Configuração guiada**: Configure o perfil, o GitHub e o canal de notificações em três etapas; depois acompanhe os resultados num dashboard simples.
-  **Monitorização opcional**: Faça uma varredura manual ou ative verificações automáticas a cada 15 minutos enquanto o servidor estiver ligado.

---

##  Como Funciona e Como Configurar

### 1. Telegram (Como encontrar informações necessárias)

Para que o seu bot envie mensagens para o seu telemóvel, são necessários dois parâmetros: **Token do Bot** e **Chat ID do Telegram**.

#### Passo A: Obter o Token do Bot
1. No seu Telegram, procure pelo bot oficial **@BotFather**.
2. Clique em `/start` e envie o comando `/newbot`.
3. Escolha o nome e um username único para o seu bot (por exemplo, `meu_radar_git_bot`).
4. O **@BotFather** irá fornecer-lhe o **Token da API** (formato: `8607073819:AAGq...`). Guarde e insira este token no painel do GitNotification.

#### Passo B: Iniciar Conversa com o Bot
- **MUITO IMPORTANTE**: Antes de testar ou utilizar o GitNotification, pesquise o username do bot que criou no seu próprio Telegram e clique em **Começar** (ou envie a instrução `/start`). Se não fizer isso, o bot não terá permissão para lhe enviar mensagens.

#### Passo C: Obter o seu Chat ID Pessoal
O **Token do Bot** serve para autenticar o bot, mas para saber *para quem* enviar as notificações, o sistema precisa do seu identificador numérico pessoal (Chat ID).
1. No Telegram, pesquise por um bot de informações como **@userinfobot** ou **@raw_data_bot**.
2. Clique em **Começar** ou `/start`.
3. O bot devolverá instantaneamente uma mensagem contendo o seu **Chat ID** (uma sequência numérica, por exemplo, `123456789`).
4. Copie este número e cole-o no campo **Seu Chat ID do Telegram** na aplicação GitNotification.

---

### 2. Twilio WhatsApp (Opcional)

Para encaminhar alertas diretamente ao seu telemóvel pessoal através do WhatsApp:
1. Registe-se na plataforma [Twilio](https://www.twilio.com/).
2. Aceda ao **Twilio Sandbox para WhatsApp** e siga as instruções para conectar o seu telemóvel ao sandbox (geralmente enviando um código como `join <palavra-chave>` para o número da Twilio).
3. Obtenha o seu **Account SID**, **Auth Token** e o número oficial do Sandbox (por exemplo, `+14155238886`).
4. No GitNotification, ative o botão do WhatsApp e insira os dados correspondentes.

---

### 3. Executando a Aplicação Localmente
A forma mais simples de ver o projeto em ação é através da nossa aplicação web implementada.

URL da Aplicação: https://gitnotification.onrender.com/

Nota: Por se tratar de um protótipo, a instância pode não estar sempre ativa.

#### Instalar Dependências
```bash
npm install
```

#### Configurar Variáveis de Ambiente
Crie um ficheiro `.env` na raiz do seu projeto e adicione a sua chave de API da Groq. Não coloque a chave real em `.env.example` nem a versione:
```env
Groq_API_KEY="A sua chave Groq"
```

O backend tenta, por ordem, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b` e `allam-2-7b`.

#### Executar em Modo de Desenvolvimento (Explorador)
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

##  Licença e Direitos

© 2026 GitNotification. Todos os direitos reservados. D´DEUS´DEUS - DDD.
