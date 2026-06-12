/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from "react";
import { 
  Cpu, 
  Sparkles, 
  RefreshCw, 
  Github, 
  Send,
  MessageSquare,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  Zap
} from "lucide-react";
import LiveFeed from "./components/LiveFeed";
import LogConsole from "./components/LogConsole";
import { ProcessedRepository, TelegramConfig, WhatsAppConfig, LogItem, SystemStatus, MonitoredUser } from "./types";

async function fetchJsonSafe<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }
    return await res.json();
  } catch (err) {
    console.warn(`Safe fetch failure for ${url}, fallback used.`, err);
    return fallback;
  }
}

export default function App() {
  // State for configs
  const [ownerUsername, setOwnerUsername] = useState("");
  const [personalToken, setPersonalToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  
  const [telegram, setTelegram] = useState<TelegramConfig>({ bot_token: "", chat_id: "", is_enabled: false });
  const [whatsapp, setWhatsapp] = useState<WhatsAppConfig>({ twilio_sid: "", twilio_token: "", phone_from: "", phone_to: "", is_enabled: false });
  
  // Monitoring data & lists
  const [monitoredUsers, setMonitoredUsers] = useState<MonitoredUser[]>([]);
  const [repositories, setRepositories] = useState<ProcessedRepository[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ is_automation_active: true, last_poll: null, polls_count: 0 });
  const [geminiActive, setGeminiActive] = useState(false);
  const [syncLastDate, setSyncLastDate] = useState<string | null>(null);

  // Loading & feedback messaging indicators
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status banners
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Simulation custom fields
  const [simOwner, setSimOwner] = useState("torvalds");
  const [simRepo, setSimRepo] = useState("linux-kernel-ai");
  const [simReadme, setSimReadme] = useState("A micro-kernel optimization repository with automated deep learning code review mechanisms.");

  const fetchData = async (isInitialCall: boolean = false) => {
    try {
      const [resStatus, resHistory, resMonitored] = await Promise.all([
        fetchJsonSafe("/api/status", {
          github_config: { owner_username: "", personal_token: "", sync_last_date: null },
          monitored_users_count: 0,
          telegram_config: { bot_token: "", chat_id: "", is_enabled: false },
          whatsapp_config: { twilio_sid: "", twilio_token: "", phone_from: "", phone_to: "", is_enabled: false },
          logs: [],
          system_status: { is_automation_active: true, last_poll: null, polls_count: 0 },
          gemini_active: false
        }),
        fetchJsonSafe<ProcessedRepository[]>("/api/history", []),
        fetchJsonSafe<MonitoredUser[]>("/api/monitored-list", [])
      ]);

      // Map response values with solid fallbacks - only override configuration when initializing or explicitly requested
      if (isInitialCall) {
        setOwnerUsername(resStatus.github_config?.owner_username || "");
        setPersonalToken(resStatus.github_config?.personal_token || "");
        setTelegram(resStatus.telegram_config || { bot_token: "", chat_id: "", is_enabled: false });
        setWhatsapp(resStatus.whatsapp_config || { twilio_sid: "", twilio_token: "", phone_from: "", phone_to: "", is_enabled: false });
      }

      setSyncLastDate(resStatus.github_config?.sync_last_date || null);
      setLogs(resStatus.logs || []);
      setSystemStatus(resStatus.system_status || { is_automation_active: true, last_poll: null, polls_count: 0 });
      setGeminiActive(!!resStatus.gemini_active);

      setRepositories(resHistory || []);
      setMonitoredUsers(resMonitored || []);
    } catch (err) {
      console.error("Erro ao carregar dados do servidor:", err);
    }
  };

  // Poll server for stats updates, but do not overwrite the user's active inputs while they are configuring them
  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfigs = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_username: ownerUsername,
          personal_token: personalToken,
          telegram,
          whatsapp
        })
      });
      if (res.ok) {
        setBanner({ type: "success", text: "Configurações de integração atualizadas!" });
        await fetchData(true);
      } else {
        setBanner({ type: "error", text: "Erro ao persistir configurações no servidor." });
      }
    } catch (err) {
      setBanner({ type: "error", text: "Incapaz de conectar de momento." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncFollowing = async () => {
    if (!ownerUsername.trim()) {
      setBanner({ type: "error", text: "Por favor, digite seu nome de usuário do GitHub para buscar seguidores." });
      return;
    }
    setIsSyncing(true);
    setBanner(null);
    try {
      // First auto save current username input
      await fetch("/api/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_username: ownerUsername, personal_token: personalToken })
      });

      const res = await fetch("/api/sync-following", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBanner({ 
          type: "success", 
          text: `Sincronização concluída! Carregados ${data.count} desenvolvedores que segue no GitHub.` 
        });
        await fetchData(true);
      } else {
        setBanner({ type: "error", text: data.error || "Erro ao consultar API do GitHub." });
      }
    } catch (err) {
      setBanner({ type: "error", text: "Falha de rede ao tentar sincronizar." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePollNow = async () => {
    setIsPolling(true);
    setBanner(null);
    try {
      const res = await fetch("/api/poll-radar", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        if (data.found > 0) {
          setBanner({ type: "success", text: `Sucesso! Novos repositórios detetados e processados: ${data.found}.` });
        } else {
          setBanner({ type: "success", text: "Verificação concluída. Nenhum repositório novo detetado nas últimas horas." });
        }
        await fetchData(false);
      } else {
        setBanner({ type: "error", text: "Erro na verificação automática." });
      }
    } catch (e) {
      setBanner({ type: "error", text: "Erro de conexão ao executar verificação manual." });
    } finally {
      setIsPolling(false);
    }
  };

  const handleClearHistory = async () => {
    // Immediately clear local states for instant visual feedback on screen
    setRepositories([]);
    try {
      const res = await fetch("/api/clean-history", { method: "POST" });
      if (res.ok) {
        setBanner({ type: "success", text: "Histórico de eventos limpo com sucesso!" });
      } else {
        setBanner({ type: "error", text: "Falha ao limpar o histórico no servidor." });
      }
      await fetchData(false);
    } catch (err) {
      console.warn("Erro ao limpar histórico:", err);
      setBanner({ type: "error", text: "Falha de rede ao limpar o histórico." });
    }
  };

  const handleTestTelegram = async () => {
    if (!telegram.bot_token || !telegram.chat_id) {
      setBanner({ type: "error", text: "Forneça Token e Chat ID do Telegram antes de testar." });
      return;
    }
    setBanner(null);
    try {
      const res = await fetch("/api/test-telegram-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: telegram.bot_token,
          chat_id: telegram.chat_id
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({ type: "success", text: "Mensagem de teste disparada! Verifique o seu telemóvel." });
      } else {
        setBanner({ type: "error", text: data.error || "Erro ao encaminhar mensagem ao Telegram." });
      }
    } catch (e) {
      setBanner({ type: "error", text: "Falha ao enviar mensagem de teste." });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Dynamic Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-600 flex items-center justify-center shadow-lg shadow-indigo-500/10 shrink-0">
              <Cpu className="w-5 h-5 text-slate-950 animate-pulse fill-current" />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-bold font-display tracking-tight text-slate-100 flex items-center gap-2">
                GitNotification <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 uppercase font-mono font-bold font-sans">Automator</span>
              </h1>
              <p className="text-[10.5px] text-slate-400 font-medium">Monitorização com IA de quem segue no GitHub e Alertas em Tempo Real</p>
            </div>
          </div>

          {/* Core telemetries & live action triggers */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${geminiActive ? "bg-emerald-400 animate-pulse" : "bg-amber-500"}`} />
               
              </div>
              <span className="text-slate-800">|</span>
              <div>
                <span>Varreduras: <strong>{systemStatus.polls_count}</strong></span>
              </div>
            </div>

            <button
              onClick={handlePollNow}
              disabled={isPolling || isSyncing}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 border border-indigo-500/20 disabled:border-slate-800 text-white disabled:text-slate-500 font-bold px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-indigo-500/5 hover:shadow-indigo-500/10"
              id="btn-manual-poll"
            >
              {isPolling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isPolling ? "Varrendo GitHub..." : "Varrer Agora"}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main minimal layout workspace wrapper */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        
        {banner && (
          <div 
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs leading-normal animate-slide-up ${
              banner.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/20 text-rose-300"
            }`}
            id="status-banner"
          >
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Bento Grid layout containing Configurations cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Section 1: GitHub Profile Monitor Source config */}
          <div className="lg:col-span-6 bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-150">1. Fonte de Dados (Seu GitHub)</h2>
                  <p className="text-xs text-slate-400">Verifique os desenvolvedores que você segue no GitHub de forma automatizada</p>
                </div>
              </div>

              {/* Username field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide font-mono block">Nome de Usuário:</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                  <input
                    type="text"
                    value={ownerUsername}
                    onChange={(e) => setOwnerUsername(e.target.value)}
                    placeholder="andrejunqueira1999"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-100 outline-none transition-all placeholder:text-slate-600 font-semibold"
                  />
                </div>
              </div>

              {/* Personal access token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide font-mono block">Token de Acesso GitHub (Opcional):</label>
                  <span className="text-[10px] text-slate-500 font-mono">Bypassa rate-limits</span>
                </div>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={personalToken}
                    onChange={(e) => setPersonalToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-100 outline-none transition-all placeholder:text-slate-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-550 leading-relaxed font-sans mt-1">
                    Altamente recomendado. Permite carregar quem segue instantaneamente e ler novos repositórios sem bloqueios de IP.
                </p>
              </div>
            </div>

            {/* Sync followed developers button */}
            <div className="pt-4 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 text-left">
                {monitoredUsers.length > 0 ? (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    A monitorar: <strong>{monitoredUsers.length}</strong> desenvolvedores
                  </span>
                ) : (
                  <span className="text-slate-500">Nenhum seguidor sincronizado</span>
                )}
                {syncLastDate && (
                  <p className="text-[9.5px] text-slate-500 mt-0.5">Sincronizado em: {new Date(syncLastDate).toLocaleDateString("pt-PT")}</p>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveConfigs();
                  }}
                  disabled={isSaving}
                  className="bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs px-3.5 py-1.5 rounded-xl border border-slate-800 transition-colors cursor-pointer w-full sm:w-auto"
                >
                  {isSaving ? "A guardar..." : "Guardar"}
                </button>

                <button
                  type="button"
                  onClick={handleSyncFollowing}
                  disabled={isSyncing}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-905 text-white text-xs font-semibold px-4 py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full sm:w-auto"
                >
                  {isSyncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  <span>Sincronizar Seguidores</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Destination Alert Notifications config (Telegram + Whatsapp) */}
          <div className="lg:col-span-6 bg-slate-900/40 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Send className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-150">2. Canal de Notificação Automatizada</h2>
                  <p className="text-xs text-slate-400">Escolha para onde encaminhar os alertas inteligentes da IA do GitNotification</p>
                </div>
              </div>

              {/* Stacked inner Cards */}
              <div className="space-y-4">
                
                {/* Telegram settings card */}
                <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-850 space-y-3.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="text-xs font-bold font-sans text-slate-200">Integração Telegram</span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={telegram.is_enabled}
                        onChange={(e) => setTelegram({ ...telegram, is_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
                      <span className="ml-1.5 text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                        {telegram.is_enabled ? "Ativo" : "Inativo"}
                      </span>
                    </label>
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 transition-all ${telegram.is_enabled ? "opacity-100" : "opacity-50"}`}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 font-bold block">Token do Bot (@BotFather):</label>
                      <input
                        type="text"
                        value={telegram.bot_token}
                        onChange={(e) => setTelegram({ ...telegram, bot_token: e.target.value })}
                        placeholder="1829102930:AAH-xk..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-650"
                        disabled={!telegram.is_enabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 font-bold block">Seu Chat ID do Telegram:</label>
                      <input
                        type="text"
                        value={telegram.chat_id}
                        onChange={(e) => setTelegram({ ...telegram, chat_id: e.target.value })}
                        placeholder="987654321"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-650"
                        disabled={!telegram.is_enabled}
                      />
                    </div>
                  </div>

                  {telegram.is_enabled && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleTestTelegram}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono font-semibold flex items-center gap-1 transition-all"
                      >
                         Testar Ligação Telegram
                      </button>
                    </div>
                  )}
                </div>

                {/* WhatsApp Settings card */}
                <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-850 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold font-sans text-slate-200">Twilio WhatsApp (Celular)</span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={whatsapp.is_enabled}
                        onChange={(e) => setWhatsapp({ ...whatsapp, is_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
                      <span className="ml-1.5 text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                        {whatsapp.is_enabled ? "Ativo" : "Inativo"}
                      </span>
                    </label>
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all ${whatsapp.is_enabled ? "opacity-100" : "opacity-50 font-medium"}`}>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-400 font-bold block">Twilio Account SID:</label>
                      <input
                        type="text"
                        value={whatsapp.twilio_sid}
                        onChange={(e) => setWhatsapp({ ...whatsapp, twilio_sid: e.target.value })}
                        placeholder="ACxxxxxxxxxxxxxxxxxx"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-slate-200 outline-none"
                        disabled={!whatsapp.is_enabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-400 font-bold block">Twilio Token:</label>
                      <input
                        type="password"
                        value={whatsapp.twilio_token}
                        onChange={(e) => setWhatsapp({ ...whatsapp, twilio_token: e.target.value })}
                        placeholder="••••••••••••••••••••"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-slate-200 outline-none font-mono"
                        disabled={!whatsapp.is_enabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-400 font-bold block">Nº de Origem (Twilio):</label>
                      <input
                        type="text"
                        value={whatsapp.phone_from}
                        onChange={(e) => setWhatsapp({ ...whatsapp, phone_from: e.target.value })}
                        placeholder="+14155238886"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-slate-200 outline-none"
                        disabled={!whatsapp.is_enabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-400 font-bold block">Seu Celular Receptivo:</label>
                      <input
                        type="text"
                        value={whatsapp.phone_to}
                        onChange={(e) => setWhatsapp({ ...whatsapp, phone_to: e.target.value })}
                        placeholder="+351912345678"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-slate-200 outline-none"
                        disabled={!whatsapp.is_enabled}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-900/60 justify-end flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveConfigs()}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                {isSaving ? "Gravando canal..." : "Gravar Definições"}
              </button>
            </div>
          </div>

        </div>



        {/* Section 3: Timeline feeds and server trace consoles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* Main Feed panel */}
          <div className="lg:col-span-8 space-y-4">
            <LiveFeed
              repositories={repositories}
              onClearFeed={handleClearHistory}
            />
          </div>

          {/* Activity terminal log output */}
          <div className="lg:col-span-4 self-start">
            <LogConsole logs={logs} />
          </div>

        </div>

      </main>

      {/* Crafted Minimalist footer */}
      <footer className="border-t border-slate-900 mt-16 py-8 px-4 bg-slate-950 text-center text-[10.5px] text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© 2026 GitNotification Automator. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-slate-350 transition-colors">
              GitHub
            </a>
            <span>•</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
