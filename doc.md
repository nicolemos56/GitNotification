# Guia de Implantação no Railway 🚀

Este documento fornece as instruções passo a passo para implantar a aplicação **GitNotification** no **Railway** de forma rápida, segura e totalmente funcional.

---

## 📋 Pré-requisitos

1. Uma conta ativa no [Railway](https://railway.app/).
2. O código do seu repositório enviado para o seu GitHub (ou você pode fazer o upload diretamente usando a CLI do Railway).
3. Uma chave de API da Gemini (opcional, para organização inteligente de alertas por IA).

---

## ⚙️ Configurações Detetadas Automaticamente

Graças à estrutura configurada no `package.json`, o Railway detectará automaticamente o projeto como **Node.js** e executará os seguintes passos:

*   **Comando de Build (compilação):** `npm run build` (Compila o frontend Vite para `dist/` e transpila o servidor backend para `dist/server.cjs`).
*   **Comando de Início (start):** `npm start` (Inicia o servidor otimizado em produção usando o Node.js).
*   **Porta (Port):** O Railway atribuirá uma porta dinâmica automaticamente através da variável de ambiente `PORT`. O servidor já está programado para escutar dinamicamente a porta fornecida.

---

## 🛠️ Passo a Passo para Implantação

### Opção 1: Implantar através do GitHub (Recomendado)

1. Vá para o painel do [Railway](https://railway.app/) e clique em **"New Project"** (+).
2. Selecione **"Deploy from GitHub repo"**.
3. Escolha o repositório da sua aplicação.
4. Clique em **"Deploy Now"**.

---

### Opção 2: Implantar através da CLI do Railway (Alternativa)

Se preferir implantar diretamente do seu terminal sem conectar um repositório GitHub:

1. Instale a CLI do Railway no seu computador:
   ```bash
   npm i -g @railway/cli
   ```
2. Faça login na sua conta:
   ```bash
   railway login
   ```
3. Inicialize o projeto na pasta raiz do código:
   ```bash
   railway init
   ```
4. Realize a implantação:
   ```bash
   railway up
   ```

---

## 🔑 Variáveis de Ambiente (Variables)

No painel do Railway, vá para a aba **Variables** do seu serviço e adicione as seguintes variáveis de ambiente:

| Variável | Descrição | Exemplo / Valor | Requisito |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Define o ambiente como produção | `production` | **Obrigatório** |
| `GEMINI_API_KEY` | Chave de API da Gemini para agrupamento de alertas inteligente | *Sua chave de API do Google AI Studio* | Opcional (Recomendado) |

> ⚠️ **Nota de Segurança:** Nunca envie as suas chaves e credenciais reais para o arquivo `.env` ou para o seu repositório público do GitHub. Configure-as sempre através da aba **Variables** no painel do Railway.

---

## 💾 Persistência da Base de Dados (`gitpulse_db.json`)

Por padrão, os containers no Railway possuem um sistema de ficheiros **efémero** (reiniciam para o estado limpo a cada nova atualização ou redistribuição de código). Como a aplicação utiliza o ficheiro local `/gitpulse_db.json` como base de dados leve:

### Como manter as suas configurações e histórico salvos?

Recomendamos **adicionar um Volume Persistente** no Railway para garantir que as credenciais do Telegram/WhatsApp e o histórico de logs não sejam reiniciados:

1. No painel do seu serviço no Railway, clique em **Settings**.
2. Desça até à secção **Volumes** e clique em **"Add Volume"**.
3. Defina o tamanho que desejar (ex: `1 GB` é mais do que suficiente para texto).
4. No campo **Mount Path** (Caminho de Montagem), defina o caminho exato onde o banco de dados vive na pasta de compilação do Railway:
   *   **Mount Path:** `/app/gitpulse_db.json`
5. Clique em salvar e aguarde o Railway reiniciar o serviço.

Pronto! As suas automações, alvos, credenciais de notificações e logs guardados estarão salvos de forma segura e duradoura.
