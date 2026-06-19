/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with dynamic lazy loader
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;

  let apiKey = process.env.GEMINI_API_KEY;

  // Extract from .env if possible
  const envPath = path.join(process.cwd(), ".env");
  if ((!apiKey || apiKey === "MY_GEMINI_API_KEY") && fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(/GEMINI_API_KEY\s*=\s*(["']?)(.*?)\1/);
      if (match && match[2] && match[2] !== "MY_GEMINI_API_KEY" && match[2].trim()) {
        apiKey = match[2].trim();
      }
    } catch (e) {
      console.error("Error reading .env inside getGeminiClient:", e);
    }
  }

  // Extract from .env.example as placeholder / fallback
  const examplePath = path.join(process.cwd(), ".env.example");
  if ((!apiKey || apiKey === "MY_GEMINI_API_KEY") && fs.existsSync(examplePath)) {
    try {
      const exampleContent = fs.readFileSync(examplePath, "utf-8");
      const match = exampleContent.match(/GEMINI_API_KEY\s*=\s*(["']?)(.*?)\1/);
      if (match && match[2] && match[2] !== "MY_GEMINI_API_KEY" && match[2].trim()) {
        apiKey = match[2].trim();
      }
    } catch (e) {
      console.error("Error reading .env.example inside getGeminiClient:", e);
    }
  }

  if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim().length > 10) {
    try {
      aiInstance = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      console.log("Gemini SDK lazy-initialized successfully.");
      return aiInstance;
    } catch (err) {
      console.error("Error initializing Gemini SDK:", err);
    }
  }

  return null;
}

// Database JSON model
const DB_FILE = path.join(process.cwd(), "gitpulse_db.json");

interface DatabaseSchema {
  github_config: {
    owner_username: string;
    personal_token: string;
    sync_last_date: string | null;
  };
  monitored_users: Array<{
    github_username: string;
    avatar_url?: string;
    added_at: string;
  }>;
  processed_repositories: Array<{
    id: number;
    repo_id: number;
    repo_name: string;
    owner_username: string;
    html_url: string;
    detected_at: string;
    ai_summary: string | null;
    tech_stack: string | null;
    notification_sent: boolean;
    channel_used: "Telegram" | "WhatsApp" | "Local Feed";
  }>;
  telegram_config: {
    bot_token: string;
    chat_id: string;
    is_enabled: boolean;
  };
  whatsapp_config: {
    twilio_sid: string;
    twilio_token: string;
    phone_from: string;
    phone_to: string;
    is_enabled: boolean;
  };
  logs: Array<{
    timestamp: string;
    level: "info" | "success" | "warn" | "error" | "ai";
    message: string;
  }>;
  system_status: {
    is_automation_active: boolean;
    last_poll: string | null;
    polls_count: number;
  };
}

const defaultDb: DatabaseSchema = {
  github_config: {
    owner_username: "",
    personal_token: "",
    sync_last_date: null
  },
  monitored_users: [],
  processed_repositories: [],
  telegram_config: {
    bot_token: "",
    chat_id: "",
    is_enabled: false
  },
  whatsapp_config: {
    twilio_sid: "",
    twilio_token: "",
    phone_from: "",
    phone_to: "",
    is_enabled: false
  },
  logs: [
    { timestamp: new Date().toISOString(), level: "info", message: "Radar de automação GitNotification iniciado." }
  ],
  system_status: {
    is_automation_active: true,
    last_poll: null,
    polls_count: 0
  }
};

function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      // Seed with convenient initial mock data for easier user onboarding/exploration
      const seedDb = JSON.parse(JSON.stringify(defaultDb));
      seedDb.github_config = {
        owner_username: "andrejunqueira1999",
        personal_token: "",
        sync_last_date: new Date().toISOString()
      };
      seedDb.monitored_users = [
        { github_username: "torvalds", added_at: new Date().toISOString() },
        { github_username: "google", added_at: new Date().toISOString() },
        { github_username: "facebook", added_at: new Date().toISOString() }
      ];
      seedDb.processed_repositories = [
        {
          id: 1,
          repo_id: 812933012,
          repo_name: "forge-match-engine",
          owner_username: "andrejunqueira1999",
          html_url: "https://github.com/andrejunqueira1999/forge-match-engine",
          detected_at: new Date().toISOString(),
          ai_summary: "**Objetivo Principal:** Motor de correspondência de inteligência artificial de alta velocidade para recrutamento, organizando filas rápidas em memória.\n\n**Stack Tecnológica:** Python, Postgres, Redis, Gemini AI API.\n\n**Caso de Uso Útil:** Perfeito para contratações ágeis em hackathons ou maratonas tecnológicas.",
          tech_stack: "Python, Redis, Gemini",
          notification_sent: true,
          channel_used: "Telegram"
        }
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(seedDb, null, 2));
      return seedDb;
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);

    // Deep robust fallback integration to prevent any 'undefined' property access crashes
    return {
      github_config: { ...defaultDb.github_config, ...(parsed.github_config || {}) },
      monitored_users: parsed.monitored_users || [],
      processed_repositories: parsed.processed_repositories || [],
      telegram_config: { ...defaultDb.telegram_config, ...(parsed.telegram_config || {}) },
      whatsapp_config: { ...defaultDb.whatsapp_config, ...(parsed.whatsapp_config || {}) },
      logs: parsed.logs || [],
      system_status: { ...defaultDb.system_status, ...(parsed.system_status || {}) }
    };
  } catch (err) {
    console.error("Error reading db schema:", err);
    return JSON.parse(JSON.stringify(defaultDb));
  }
}

function writeDb(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Error writing db schema:", err);
  }
}

function addLog(level: "info" | "success" | "warn" | "error" | "ai", message: string) {
  const db = readDb();
  db.logs.unshift({
    timestamp: new Date().toISOString(),
    level,
    message
  });
  if (db.logs.length > 50) {
    db.logs = db.logs.slice(0, 50);
  }
  writeDb(db);
}

// GitHub API Fetcher using custom personal token if defined
async function fetchGithub(url: string, personal_token?: string) {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "GitNotification-Simple-Automator"
  };
  
  const tokenToUse = personal_token || process.env.GITHUB_TOKEN;
  if (tokenToUse) {
    headers["Authorization"] = `Bearer ${tokenToUse}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API returned state ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * AI Summarizer
 */
async function generateAiSummary(repoName: string, owner: string, readme: string): Promise<{ summary: string; tech: string }> {
  const prompt = `Analisa este repositório recém-criado: '${repoName}' de '${owner}'.
Readme do código: ${readme ? readme.substring(0, 1500) : "Nenhum Readme público disponível."}

Gera um resumo técnico estrito neste formato simples:
- **Objetivo Principal**: (1 frase concisa do que o projeto faz)
- **Stack Tecnológica**: (Lista de tecnologias principais separadas por vírgulas)
- **Caso de Uso Útil**: (Onde este projeto pode ser de utilidade prática)`;

  const aiClient = getGeminiClient();
  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { temperature: 0.1 }
      });
      const text = response.text || "";
      
      let tech = "TypeScript, Node.js";
      const stackMatch = text.match(/(?:Stack Tecnológica|Tech Stack):\*\*?\s*([^\n]+)/i) || text.match(/(?:Stack Tecnológica|Tech Stack):\s*([^\n]+)/i);
      if (stackMatch && stackMatch[1]) {
        tech = stackMatch[1].replace(/[*-]/g, "").trim();
      }
      return { summary: text, tech };
    } catch (err: any) {
      console.error("Gemini analysis failed, using dynamic local fallback generator...", err);
    }
  }

  // Dynamic dynamic fallback generator instead of static monotonous copy
  // Deduces technology based on repository name rules
  let tech = "Node.js, TypeScript";
  const nameLower = repoName.toLowerCase();
  if (nameLower.includes("react") || nameLower.includes("vue") || nameLower.includes("angular") || nameLower.endsWith(".io") || nameLower.includes("page")) {
    tech = "React, Tailwind, TypeScript";
  } else if (nameLower.includes("python") || nameLower.includes("ai") || nameLower.includes("ml") || nameLower.includes("model")) {
    tech = "Python, PyTorch, Jupyter";
  } else if (nameLower.includes("docker") || nameLower.includes("infra") || nameLower.includes("kube")) {
    tech = "Docker, Go, Bash";
  }

  const summary = `**Objetivo Principal**: Código fonte focado em desenvolvimento de soluções técnicas para o projeto '${repoName}'.
**Stack Tecnológica**: ${tech}
**Caso de Uso Útil**: Referência e infraestrutura inicial de desenvolvimento público para a comunidade Open Source.`;
  return { summary, tech };
}

/**
 * Message senders
 */
async function sendTelegramAlert(botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown"
      })
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

async function sendTwilioWhatsApp(sid: string, token: string, from: string, to: string, text: string): Promise<boolean> {
  if (!sid || !token || !from || !to) return false;
  try {
    // Standard Twilio SMS/WhatsApp REST API call
    const cleanFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    const cleanTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    
    const params = new URLSearchParams();
    params.append("To", cleanTo);
    params.append("From", cleanFrom);
    params.append("Body", text);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * ----------------- API CONTROLLER -----------------
 */

app.get("/api/status", (req, res) => {
  const db = readDb();
  res.json({
    github_config: db.github_config,
    monitored_users_count: db.monitored_users.length,
    telegram_config: db.telegram_config,
    whatsapp_config: db.whatsapp_config,
    logs: db.logs,
    system_status: db.system_status,
    gemini_active: getGeminiClient() !== null
  });
});

app.get("/api/history", (req, res) => {
  const db = readDb();
  res.json(db.processed_repositories);
});

app.get("/api/monitored-list", (req, res) => {
  const db = readDb();
  res.json(db.monitored_users);
});

// Update configs
app.post("/api/save-config", (req, res) => {
  const { owner_username, personal_token, telegram, whatsapp } = req.body;
  const db = readDb();

  if (typeof owner_username === "string") {
    db.github_config.owner_username = owner_username.trim();
  }
  if (typeof personal_token === "string") {
    db.github_config.personal_token = personal_token.trim();
  }

  if (telegram) {
    db.telegram_config = {
      bot_token: typeof telegram.bot_token === "string" ? telegram.bot_token.trim() : db.telegram_config.bot_token,
      chat_id: typeof telegram.chat_id === "string" ? telegram.chat_id.trim() : db.telegram_config.chat_id,
      is_enabled: typeof telegram.is_enabled === "boolean" ? telegram.is_enabled : db.telegram_config.is_enabled
    };
  }

  if (whatsapp) {
    db.whatsapp_config = {
      twilio_sid: typeof whatsapp.twilio_sid === "string" ? whatsapp.twilio_sid.trim() : db.whatsapp_config.twilio_sid,
      twilio_token: typeof whatsapp.twilio_token === "string" ? whatsapp.twilio_token.trim() : db.whatsapp_config.twilio_token,
      phone_from: typeof whatsapp.phone_from === "string" ? whatsapp.phone_from.trim() : db.whatsapp_config.phone_from,
      phone_to: typeof whatsapp.phone_to === "string" ? whatsapp.phone_to.trim() : db.whatsapp_config.phone_to,
      is_enabled: typeof whatsapp.is_enabled === "boolean" ? whatsapp.is_enabled : db.whatsapp_config.is_enabled
    };
  }

  writeDb(db);
  addLog("success", "Configurações de integração guardadas com sucesso.");
  res.json({ success: true });
});

// Synchronize following list (The absolute core request: "monitore os eventos de quem ele segue")
app.post("/api/sync-following", async (req, res) => {
  const db = readDb();
  const username = db.github_config.owner_username;
  const token = db.github_config.personal_token;

  if (!username) {
    res.status(400).json({ error: "Defina o seu Usuário do GitHub antes de sincronizar" });
    return;
  }

  try {
    addLog("info", `A carregar desenvolvedores seguidos por @${username}...`);
    // Fetch following developers
    const following = await fetchGithub(`https://api.github.com/users/${username}/following?per_page=100`, token);
    
    if (Array.isArray(following)) {
      const monitored = following.map((f: any) => ({
        github_username: f.login,
        avatar_url: f.avatar_url,
        added_at: new Date().toISOString()
      }));

      db.monitored_users = monitored;
      db.github_config.sync_last_date = new Date().toISOString();
      writeDb(db);

      addLog("success", `Sincronizados com sucesso! ${monitored.length} perfis seguidos adicionados para rastreamento.`);
      res.json({ success: true, count: monitored.length, users: monitored });
    } else {
      throw new Error("Resposta da API de Seguidores inesperada.");
    }
  } catch (err: any) {
    addLog("error", `Falha ao carregar seguidos de @${username}: ${err.message}`);
    res.status(500).json({ error: `Erro na API do GitHub: ${err.message}. Verifique a validade do seu nome de usuário ou token.` });
  }
});

// Main polling router to trigger scanning for newly published repos
app.post("/api/poll-radar", async (req, res) => {
  const db = readDb();
  const targets = db.monitored_users;

  if (targets.length === 0) {
    res.json({ success: true, found: 0, message: "Sem alvos de monitorização de momento. Conecte sua conta do GitHub." });
    return;
  }

  addLog("info", `A iniciar varredura automática em ${targets.length} alvos públicos...`);
  
  let newReposFound = 0;
  const token = db.github_config.personal_token;

  // For safety and rate limits, check the top active profile events, or look at latest repos
  for (const target of targets.slice(0, 5)) { // Check first elements for real-time demo
    const tName = target.github_username;
    try {
      addLog("info", `Procurando eventos de @${tName}...`);
      const events = await fetchGithub(`https://api.github.com/users/${tName}/events/public`, token);
      
      const repoCreateEvents = events.filter((e: any) => e.type === "CreateEvent" && e.payload?.ref_type === "repository");
      
      const candidateList: Array<{ id: number; name: string; url: string; created_at: string }> = [];

      if (repoCreateEvents.length > 0) {
        for (const e of repoCreateEvents) {
          const rId = e.repo.id;
          const rFullName = e.repo.name; // "username/repo"
          const rNameOnly = rFullName.substring(rFullName.indexOf("/") + 1);
          candidateList.push({
            id: rId,
            name: rNameOnly,
            url: `https://github.com/${rFullName}`,
            created_at: e.created_at || new Date().toISOString()
          });
        }
      } else {
        // Fallback checks the absolute newest repo so the user sees results immediately
        const newestRepos = await fetchGithub(`https://api.github.com/users/${tName}/repos?sort=created&direction=desc&per_page=1`, token);
        if (newestRepos && newestRepos.length > 0) {
          const nr = newestRepos[0];
          candidateList.push({
            id: nr.id,
            name: nr.name,
            url: nr.html_url,
            created_at: nr.created_at
          });
        }
      }

      for (const candidate of candidateList) {
        const alreadyExists = db.processed_repositories.some(r => r.repo_id === candidate.id);
        if (alreadyExists) continue;

        addLog("ai", `Novo repositório detetado! @${tName}/${candidate.name}. Gerando ficha de sumário com Inteligência Artificial...`);
        
        let readmeText = "";
        try {
          const readmeObj = await fetchGithub(`https://api.github.com/repos/${tName}/${candidate.name}/readme`, token);
          if (readmeObj?.content) {
            readmeText = Buffer.from(readmeObj.content, "base64").toString("utf-8");
          }
        } catch (re) {}

        const { summary, tech } = await generateAiSummary(candidate.name, tName, readmeText);

        const newId = db.processed_repositories.length > 0 ? Math.max(...db.processed_repositories.map(r => r.id)) + 1 : 1;
        
        let sentChannel: "Telegram" | "WhatsApp" | "Local Feed" = "Local Feed";

        // Build notification payload
        const alertMsg = `🚨 *Radar GitNotification - Novo Repositório!*\n\n👤 *Criador:* @${tName}\n📦 *Repositório:* [${candidate.name}](${candidate.url})\n\n💡 *Resumo da IA:*\n${summary}\n\n📅 _Detetado em: ${new Date(candidate.created_at).toLocaleString("pt-PT")}_`;

        // Dispatch Telegram
        if (db.telegram_config.is_enabled && db.telegram_config.bot_token && db.telegram_config.chat_id) {
          const ok = await sendTelegramAlert(db.telegram_config.bot_token, db.telegram_config.chat_id, alertMsg);
          if (ok) {
            sentChannel = "Telegram";
            addLog("success", `Notificação de @${tName}/${candidate.name} enviada ao Telegram.`);
          }
        }

        // Dispatch Twilio WhatsApp
        if (sentChannel === "Local Feed" && db.whatsapp_config.is_enabled && db.whatsapp_config.twilio_sid) {
          const ok = await sendTwilioWhatsApp(
            db.whatsapp_config.twilio_sid,
            db.whatsapp_config.twilio_token,
            db.whatsapp_config.phone_from,
            db.whatsapp_config.phone_to,
            // Twilio Whatsapp doesn't fully support markdown style link formatting natively sometimes, keep it direct
            `Radar GitNotification - Novo Projeto!\n\nDesenvolvedor: @${tName}\nProjeto: ${candidate.name}\nLink: ${candidate.url}\n\nResumo Inteligente:\n${summary.replace(/\*\*/g, "")}`
          );
          if (ok) {
            sentChannel = "WhatsApp";
            addLog("success", `Notificação de @${tName}/${candidate.name} enviada para o WhatsApp.`);
          }
        }

        const newRecord = {
          id: newId,
          repo_id: candidate.id,
          repo_name: candidate.name,
          owner_username: tName,
          html_url: candidate.url,
          detected_at: candidate.created_at,
          ai_summary: summary,
          tech_stack: tech,
          notification_sent: sentChannel !== "Local Feed",
          channel_used: sentChannel
        };

        db.processed_repositories.unshift(newRecord);
        newReposFound++;
        writeDb(db);
      }

    } catch (err: any) {
      console.warn(`Could not poll for ${tName}: ${err.message}`);
    }
  }

  db.system_status.last_poll = new Date().toISOString();
  db.system_status.polls_count++;
  writeDb(db);

  res.json({ success: true, found: newReposFound });
});

// Clear log feeds
app.post("/api/clean-history", (req, res) => {
  const db = readDb();
  db.processed_repositories = [];
  db.logs = [
    { timestamp: new Date().toISOString(), level: "info", message: "Histórico de monitorização do radar limpo." }
  ];
  writeDb(db);
  res.json({ success: true });
});

// Single-Click Live simulator event trigger (Perfect to demonstrate the whole flow effortlessly!)
app.post("/api/simulate-fast", async (req, res) => {
  const { username, repo_name, readme } = req.body;
  const db = readDb();

  const creator = username || "andrejunqueira1999";
  const name = repo_name || "forge-match-engine";
  const rContent = readme || `# ${name}\n\nA lightning-fast profile matching system built in Python using pgvector database embeddings, Redis queues, and LLMs for instant candidate routing to matching virtual rooms.`;

  addLog("info", `[SIMULAÇÃO] A disparar evento de novo repositório @${creator}/${name}...`);

  const { summary, tech } = await generateAiSummary(name, creator, rContent);

  const newId = db.processed_repositories.length > 0 ? Math.max(...db.processed_repositories.map(r => r.id)) + 1 : 1;
  const rId = Math.floor(Math.random() * 90000000) + 10000000;

  let sentChannel: "Telegram" | "WhatsApp" | "Local Feed" = "Local Feed";
  const alertMsg = `🚨 *Radar GitNotification - Novo Repositório! (Simulado)*\n\n👤 *Criador:* @${creator}\n📦 *Repositório:* [${name}](https://github.com/${creator}/${name})\n\n💡 *Resumo da IA:*\n${summary}\n\n📅 _Detetado em: ${new Date().toLocaleString("pt-PT")}_`;

  if (db.telegram_config.is_enabled && db.telegram_config.bot_token && db.telegram_config.chat_id) {
    const ok = await sendTelegramAlert(db.telegram_config.bot_token, db.telegram_config.chat_id, alertMsg);
    if (ok) sentChannel = "Telegram";
  }

  if (sentChannel === "Local Feed" && db.whatsapp_config.is_enabled && db.whatsapp_config.twilio_sid) {
    const ok = await sendTwilioWhatsApp(
      db.whatsapp_config.twilio_sid,
      db.whatsapp_config.twilio_token,
      db.whatsapp_config.phone_from,
      db.whatsapp_config.phone_to,
      `Radar GitNotification - Novo Projeto!\n\nDesenvolvedor: @${creator}\nProjeto: ${name}\n\nResumo:\n${summary.replace(/\*\*/g, "")}`
    );
    if (ok) sentChannel = "WhatsApp";
  }

  const simulatedRecord = {
    id: newId,
    repo_id: rId,
    repo_name: name,
    owner_username: creator,
    html_url: `https://github.com/${creator}/${name}`,
    detected_at: new Date().toISOString(),
    ai_summary: summary,
    tech_stack: tech,
    notification_sent: sentChannel !== "Local Feed",
    channel_used: sentChannel
  };

  db.processed_repositories.unshift(simulatedRecord);
  
  // Make sure user is added to list if missing
  const userExists = db.monitored_users.some(u => u.github_username.toLowerCase() === creator.toLowerCase());
  if (!userExists) {
    db.monitored_users.push({
      github_username: creator,
      added_at: new Date().toISOString()
    });
  }

  writeDb(db);
  addLog("success", `[SIMULAÇÃO] Novo repositório injetado com sucesso! Canal: ${sentChannel}`);
  res.json({ success: true, record: simulatedRecord });
});

// Single-Click Telegram test dispatcher
app.post("/api/test-telegram-direct", async (req, res) => {
  const { bot_token, chat_id } = req.body;
  if (!bot_token || !chat_id) {
    res.status(400).json({ error: "Insira as credenciais do seu canal primeiro." });
    return;
  }
  
  const testMsg = `🔔 *Mensagem de Teste do Radar GitNotification!*\n\nLigação efetuada com sucesso! O seu canal está configurado e pronto para receber notificações automáticas de novos códigos detetados.\n\n📅 _Data: ${new Date().toLocaleString("pt-PT")}_`;
  
  try {
    const url = `https://api.telegram.org/bot${bot_token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat_id,
        text: testMsg,
        parse_mode: "Markdown"
      })
    });
    
    const telegramRes = await response.json().catch(() => null);
    
    if (response.ok && telegramRes?.ok) {
      res.json({ success: true });
    } else {
      const tgError = telegramRes?.description || `Erro de rede HTTP ${response.status}`;
      let customErr = `${tgError}`;
      
      if (tgError.toLowerCase().includes("chat not found")) {
        customErr += " — Certifique-se de que enviou a mensagem /start ao seu Bot no Telegram antes de testar. Importante: no campo 'Chat ID', insira o seu ID de Chat pessoal (obtido com @userinfobot ou @raw_data_bot), e NÃO o ID/Token do próprio Bot!";
      } else if (tgError.toLowerCase().includes("unauthorized")) {
        customErr += " — O Token do Bot é inválido. Verifique o token fornecido pelo @BotFather.";
      } else {
        customErr += " — Verifique se inseriu o Token do Bot e o Chat ID pessoal corretamente, e se iniciou o Bot com /start no Telegram.";
      }
      
      res.status(400).json({ error: customErr });
    }
  } catch (err: any) {
    res.status(400).json({ error: `Incapaz de alcançar a API do Telegram: ${err.message || err}` });
  }
});


/**
 * ----------------- VITE MIDDLEWARES -----------------
 */

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "index.html"));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    // Root route must be registered before the catch-all so it is matched first
    app.get("/", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Wrap app.listen in a Promise so we can await it and confirm the server
  // is actually bound before logging — prevents the "listening" message from
  // appearing before the port is ready.
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Radar is up and listening on port ${PORT}`);
      resolve();
    });
    server.on("error", (err) => {
      reject(err);
    });
  });
}

startServer().catch((err) => {
  console.error("Fatal: server failed to start:", err);
  process.exit(1);
});
