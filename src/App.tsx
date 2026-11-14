/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Clock3,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  KeyRound,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { MonitoredUser, ProcessedRepository, TelegramConfig, WhatsAppConfig } from "./types";

type Channel = "telegram" | "whatsapp";
type Banner = { type: "success" | "error"; text: string };
type ApiError = Error & { rateLimit?: boolean; retryAfterMinutes?: number };

interface AppStatus {
  display_name: string;
  notification_channel: Channel;
  monitoring_enabled: boolean;
  github_config: {
    owner_username: string;
    personal_token: string;
    sync_last_date: string | null;
  };
  telegram_config: TelegramConfig;
  whatsapp_config: WhatsAppConfig;
  logs: Array<{ timestamp: string; level: string; message: string }>;
  system_status: {
    is_automation_active: boolean;
    last_poll: string | null;
    polls_count: number;
  };
  groq_configured: boolean;
}

const emptyTelegram: TelegramConfig = { bot_token: "", chat_id: "", is_enabled: false };
const emptyWhatsApp: WhatsAppConfig = {
  twilio_sid: "",
  twilio_token: "",
  phone_from: "",
  phone_to: "",
  is_enabled: false
};
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400";

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null) as {
    error?: unknown;
    rate_limit?: unknown;
    retry_after_minutes?: unknown;
  } | null;
  const error = new Error(typeof body?.error === "string" ? body.error : fallback) as ApiError;
  if (body?.rate_limit === true) {
    error.rateLimit = true;
    if (typeof body.retry_after_minutes === "number") {
      error.retryAfterMinutes = body.retry_after_minutes;
    }
  }
  return error;
}

function isRateLimitError(error: unknown): error is ApiError {
  return error instanceof Error && "rateLimit" in error && error.rateLimit === true;
}

function formatDate(value: string | null): string {
  if (!value) return "Ainda não houve varredura";
  return new Date(value).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

export default function App() {
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [personalToken, setPersonalToken] = useState("");
  const [telegram, setTelegram] = useState<TelegramConfig>(emptyTelegram);
  const [whatsapp, setWhatsapp] = useState<WhatsAppConfig>(emptyWhatsApp);
  const [channel, setChannel] = useState<Channel>("telegram");
  const [step, setStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [scanOnFinish, setScanOnFinish] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [repositories, setRepositories] = useState<ProcessedRepository[]>([]);
  const [monitoredUsers, setMonitoredUsers] = useState<MonitoredUser[]>([]);
  const [pollCount, setPollCount] = useState(0);
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [rateLimitDialog, setRateLimitDialog] = useState<{ retryAfterMinutes: number | null } | null>(null);

  const loadData = async (includeConfig = false) => {
    const [statusResponse, historyResponse, usersResponse] = await Promise.all([
      fetch("/api/status"),
      fetch("/api/history"),
      fetch("/api/monitored-list")
    ]);
    if (!statusResponse.ok || !historyResponse.ok || !usersResponse.ok) {
      throw new Error("Não foi possível carregar os dados do dashboard.");
    }

    const [status, history, users] = await Promise.all([
      statusResponse.json() as Promise<AppStatus>,
      historyResponse.json() as Promise<ProcessedRepository[]>,
      usersResponse.json() as Promise<MonitoredUser[]>
    ]);

    if (includeConfig) {
      setDisplayName(status.display_name || "");
      setOwnerUsername(status.github_config?.owner_username || "");
      setPersonalToken(status.github_config?.personal_token || "");
      setTelegram(status.telegram_config || emptyTelegram);
      setWhatsapp(status.whatsapp_config || emptyWhatsApp);
      setChannel(status.notification_channel || "telegram");
      setPhoneNumber(status.whatsapp_config?.phone_to || "");
      const configured = Boolean(status.display_name?.trim() && status.github_config?.owner_username?.trim());
      setIsConfigured(configured);
      setShowWizard(!configured);
    }

    if (includeConfig) {
      setMonitoringEnabled(!!status.monitoring_enabled);
    }
    setPollCount(status.system_status?.polls_count || 0);
    setLastPoll(status.system_status?.last_poll || null);
    setRepositories(Array.isArray(history) ? history : []);
    setMonitoredUsers(Array.isArray(users) ? users : []);
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        await loadData(true);
      } catch (error) {
        if (active) {
          setBanner({ type: "error", text: error instanceof Error ? error.message : "Erro ao carregar a aplicação." });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void initialize();
    const interval = window.setInterval(() => {
      void loadData().catch((error) => console.error("Erro ao atualizar o dashboard:", error));
    }, 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const runScan = async () => {
    setIsPolling(true);
    setBanner(null);
    try {
      const response = await fetch("/api/poll-radar", { method: "POST" });
      if (!response.ok) throw await responseError(response, "Não foi possível concluir a varredura.");
      const result = await response.json();
      await loadData();
      if (result.analysisFailures > 0) {
        setBanner({
          type: "error",
          text: `Varredura concluída; ${result.analysisFailures} análise(s) falharam. Consulte novamente mais tarde.`
        });
      } else if (result.found > 0) {
        setBanner({ type: "success", text: `${result.found} novo(s) repositório(s) analisado(s).` });
      } else {
        setBanner({ type: "success", text: "Tudo em dia: não há repositórios novos nos últimos 30 dias." });
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        setBanner(null);
        setRateLimitDialog({ retryAfterMinutes: error.retryAfterMinutes ?? null });
      } else {
        setBanner({
          type: "error",
          text: error instanceof Error ? error.message : "Falha de ligação ao executar a varredura."
        });
      }
    } finally {
      setIsPolling(false);
    }
  };

  const syncFollowing = async () => {
    const response = await fetch("/api/sync-following", { method: "POST" });
    if (!response.ok) throw await responseError(response, "Não foi possível sincronizar os perfis seguidos.");
    const result = await response.json();
    return result.count as number;
  };

  const completeSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step < 2) {
      if (step === 0 && !displayName.trim()) {
        setBanner({ type: "error", text: "Diz-nos como podemos chamar-te." });
        return;
      }
      if (step === 1 && !ownerUsername.trim()) {
        setBanner({ type: "error", text: "Indica o teu nome de usuário do GitHub." });
        return;
      }
      setBanner(null);
      setStep(step + 1);
      return;
    }
    if (!displayName.trim() || !ownerUsername.trim()) {
      setBanner({ type: "error", text: "Preencha o seu nome e o nome de usuário do GitHub." });
      return;
    }

    const selectedTelegram = { ...telegram, is_enabled: channel === "telegram" };
    const selectedWhatsApp = {
      ...whatsapp,
      phone_to: phoneNumber.trim() || whatsapp.phone_to,
      is_enabled: channel === "whatsapp"
    };
    if (channel === "telegram" && (!selectedTelegram.bot_token.trim() || !selectedTelegram.chat_id.trim())) {
      setBanner({ type: "error", text: "Preencha o token do bot e o Chat ID do Telegram." });
      return;
    }
    if (channel === "whatsapp" && (
      !selectedWhatsApp.twilio_sid.trim()
      || !selectedWhatsApp.twilio_token.trim()
      || !selectedWhatsApp.phone_from.trim()
      || !selectedWhatsApp.phone_to.trim()
    )) {
      setBanner({ type: "error", text: "Preencha todos os dados do Twilio e o número de destino do WhatsApp." });
      return;
    }

    setIsSaving(true);
    setBanner(null);
    try {
      const saveResponse = await fetch("/api/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          owner_username: ownerUsername.trim(),
          personal_token: personalToken.trim(),
          notification_channel: channel,
          telegram: selectedTelegram,
          whatsapp: selectedWhatsApp
        })
      });
      if (!saveResponse.ok) throw await responseError(saveResponse, "Não foi possível guardar as configurações.");

      setTelegram(selectedTelegram);
      setWhatsapp(selectedWhatsApp);
      const followedCount = await syncFollowing();

      setIsConfigured(true);
      setShowWizard(false);
      await loadData();
      if (scanOnFinish) {
        await runScan();
      } else {
        setBanner({
          type: "success",
          text: `${followedCount} perfil(is) sincronizado(s). Já podes iniciar uma varredura quando quiseres.`
        });
      }

      const monitoringResponse = await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: monitoringEnabled })
      });
      if (!monitoringResponse.ok) {
        throw await responseError(monitoringResponse, "Não foi possível guardar a preferência de monitorização.");
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        setBanner(null);
        setRateLimitDialog({ retryAfterMinutes: error.retryAfterMinutes ?? null });
      } else {
        setBanner({
          type: "error",
          text: error instanceof Error ? error.message : "Não foi possível concluir a configuração."
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMonitoring = async () => {
    const nextEnabled = !monitoringEnabled;
    try {
      const response = await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      if (!response.ok) throw await responseError(response, "Não foi possível atualizar a monitorização.");
      setMonitoringEnabled(nextEnabled);
      setBanner({
        type: "success",
        text: nextEnabled
          ? "Monitorização contínua ativada. A ferramenta fará varreduras a cada 15 minutos."
          : "Monitorização contínua pausada. Pode continuar a usar «Varrer agora»."
      });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof Error ? error.message : "Falha ao atualizar a monitorização." });
    }
  };

  const resetConfiguration = async () => {
    if (!window.confirm("Apagar a configuração, os seguidores e todo o histórico? Esta ação não pode ser desfeita.")) return;
    setIsClearing(true);
    try {
      const response = await fetch("/api/reset-data", { method: "POST" });
      if (!response.ok) throw await responseError(response, "Não foi possível apagar os dados.");
      setDisplayName("");
      setPhoneNumber("");
      setOwnerUsername("");
      setPersonalToken("");
      setTelegram(emptyTelegram);
      setWhatsapp(emptyWhatsApp);
      setChannel("telegram");
      setMonitoringEnabled(false);
      setScanOnFinish(true);
      setRepositories([]);
      setMonitoredUsers([]);
      setPollCount(0);
      setLastPoll(null);
      setIsConfigured(false);
      setStep(0);
      setShowWizard(true);
      setBanner(null);
    } catch (error) {
      setBanner({ type: "error", text: error instanceof Error ? error.message : "Falha ao apagar os dados." });
    } finally {
      setIsClearing(false);
    }
  };

  const selectedChannelName = channel === "telegram" ? "Telegram" : "WhatsApp";
  const steps = ["Você", "GitHub", "Notificações"];
  const openGithubTokenSettings = () => {
    setRateLimitDialog(null);
    setBanner(null);
    setStep(1);
    setShowWizard(true);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label="A carregar" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">GitNotification</h1>
              <p className="text-xs text-slate-600">
                Olá<span>{displayName ? `, ${displayName}` : ""}</span>. Avisaremos no {selectedChannelName} quando surgir um repositório novo.
              </p>
            </div>
          </div>
          {isConfigured && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runScan}
                disabled={isPolling}
                title="Faz uma varredura pontual agora. Ative a monitorização contínua se quiser verificações automáticas a cada 15 minutos."
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
              >
                {isPolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isPolling ? "A verificar..." : "Varrer agora"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(0); setScanOnFinish(false); setShowWizard(true); }}
                title="Editar a configuração"
                className="rounded-xl border border-slate-300 p-2.5 text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                aria-label="Editar configuração"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetConfiguration}
                disabled={isClearing || isPolling}
                title="Apagar configuração e começar novamente"
                className="rounded-xl border border-rose-200 p-2.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                aria-label="Resetar configuração"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {banner && !showWizard && (
          <div
            role="status"
            className={`mb-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              banner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {banner.type === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{banner.text}</span>
          </div>
        )}

        {isConfigured ? (
          <>
            <section className="mb-8 flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bell className={`h-4 w-4 ${monitoringEnabled ? "text-emerald-600" : "text-slate-500"}`} />
                  {monitoringEnabled ? "Monitorização contínua ativa" : "Monitorização contínua pausada"}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {monitoringEnabled
                    ? "Novos repositórios serão verificados a cada 15 minutos enquanto o servidor estiver ligado."
                    : "A varredura manual continua disponível no botão «Varrer agora»."}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {monitoredUsers.length} perfis seguidos · Última verificação: {formatDate(lastPoll)} · {pollCount} varredura(s)
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={monitoringEnabled}
                onClick={toggleMonitoring}
                title="Ativa ou pausa as varreduras automáticas a cada 15 minutos."
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                  monitoringEnabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span className={`h-5 w-5 rounded-full bg-white transition ${monitoringEnabled ? "translate-x-6" : "translate-x-1"}`} />
                <span className="sr-only">Monitorização contínua</span>
              </button>
            </section>

            <section aria-labelledby="repositories-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="repositories-heading" className="text-xl font-semibold">Repositórios recentes</h2>
                  <p className="mt-1 text-sm text-slate-600">Projetos criados nos últimos 30 dias por pessoas que segues.</p>
                </div>
                <span className="text-xs text-slate-500">{repositories.length} encontrado(s)</span>
              </div>

              {repositories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
                  <Github className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  <p className="font-medium text-slate-700">Ainda não há repositórios recentes</p>
                  <p className="mt-1 text-sm text-slate-500">Use «Varrer agora» ou deixe a monitorização contínua ativa.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {repositories.map((repository) => (
                    <article key={repository.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-600">
                            @{repository.owner_username} · {formatDate(repository.detected_at)}
                          </p>
                          <h3 className="mt-1 flex items-center gap-2 text-base font-semibold">
                            {repository.repo_name}
                            <a
                              href={repository.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir ${repository.repo_name} no GitHub`}
                              className="text-slate-500 transition hover:text-indigo-600"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </h3>
                        </div>
                        {repository.tech_stack && (
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                            {repository.tech_stack}
                          </span>
                        )}
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{repository.ai_summary}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <UserRound className="mx-auto mb-4 h-10 w-10 text-indigo-600" />
            <h2 className="text-xl font-semibold">Vamos configurar as notificações</h2>
            <p className="mt-2 text-sm text-slate-600">São só três etapas rápidas. Depois, verá aqui os novos repositórios.</p>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Começar configuração
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Todos © 2026 GitNotificação. Todos os direitos reservados. D´DEUS´DEUS - DDD.
      </footer>

      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
          >
            {banner && (
              <div
                role="alert"
                className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                  banner.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {banner.type === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{banner.text}</span>
              </div>
            )}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-indigo-600">Etapa {step + 1} de 3</p>
                <h2 id="setup-title" className="mt-2 text-xl font-semibold">{steps[step]}</h2>
              </div>
              {isConfigured && (
                <button
                  type="button"
                  onClick={() => setShowWizard(false)}
                  aria-label="Fechar configuração"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="mb-7 flex gap-2" aria-label="Progresso da configuração">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-indigo-600" : "bg-slate-200"}`}
                />
              ))}
            </div>

            <form onSubmit={completeSetup}>
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="display-name" className="mb-2 block text-sm font-medium">Como podemos chamar-te?</label>
                    <input
                      id="display-name"
                      autoFocus
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="O teu nome"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="phone-number" className="mb-2 block text-sm font-medium">Número de telefone <span className="font-normal text-slate-500">(opcional)</span></label>
                    <input
                      id="phone-number"
                      type="tel"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="+351 912 345 678"
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-slate-500">Usaremos este número como destino se escolheres WhatsApp.</p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="github-username" className="mb-2 block text-sm font-medium">Nome de usuário do GitHub</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-500">@</span>
                      <input
                        id="github-username"
                        autoFocus
                        value={ownerUsername}
                        onChange={(event) => setOwnerUsername(event.target.value)}
                        placeholder="nicolemos56"
                        className={`${inputClass} pl-9`}
                        required
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Vamos acompanhar os perfis públicos que segues.</p>
                  </div>
                  <div>
                    <label htmlFor="github-token" className="mb-2 block text-sm font-medium">
                      Token de acesso GitHub <span className="font-normal text-slate-500">(opcional, recomendado)</span>
                    </label>
                    <input
                      id="github-token"
                      type="password"
                      autoComplete="new-password"
                      value={personalToken}
                      onChange={(event) => setPersonalToken(event.target.value)}
                      placeholder="ghp_..."
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-slate-500">Ajuda a evitar limites de consultas do GitHub.</p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
                    <Bell className="h-4 w-4 shrink-0" />
                    Os avisos serão enviados para o {selectedChannelName} quando os perfis que segues criarem projetos.
                  </div>
                  <fieldset>
                    <legend className="mb-3 text-sm font-medium">Onde queres receber os avisos?</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setChannel("telegram")}
                        aria-pressed={channel === "telegram"}
                        className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                          channel === "telegram" ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-slate-400"
                        }`}
                      >
                        <Send className="h-5 w-5 text-sky-600" />
                        <span className="text-sm font-medium">Telegram</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannel("whatsapp")}
                        aria-pressed={channel === "whatsapp"}
                        className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                          channel === "whatsapp" ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-slate-400"
                        }`}
                      >
                        <MessageCircle className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-medium">WhatsApp</span>
                      </button>
                    </div>
                  </fieldset>

                  {channel === "telegram" ? (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="telegram-token" className="mb-2 block text-sm font-medium">Token do bot</label>
                        <input
                          id="telegram-token"
                          type="password"
                          autoComplete="new-password"
                          value={telegram.bot_token}
                          onChange={(event) => setTelegram({ ...telegram, bot_token: event.target.value })}
                          placeholder="Token recebido do BotFather"
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="telegram-chat-id" className="mb-2 block text-sm font-medium">Chat ID do Telegram</label>
                        <input
                          id="telegram-chat-id"
                          value={telegram.chat_id}
                          onChange={(event) => setTelegram({ ...telegram, chat_id: event.target.value })}
                          placeholder="O teu Chat ID"
                          className={inputClass}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="twilio-sid" className="mb-2 block text-sm font-medium">Twilio Account SID</label>
                        <input id="twilio-sid" value={whatsapp.twilio_sid} onChange={(event) => setWhatsapp({ ...whatsapp, twilio_sid: event.target.value })} placeholder="AC..." className={inputClass} required />
                      </div>
                      <div>
                        <label htmlFor="twilio-token" className="mb-2 block text-sm font-medium">Twilio Auth Token</label>
                        <input id="twilio-token" type="password" autoComplete="new-password" value={whatsapp.twilio_token} onChange={(event) => setWhatsapp({ ...whatsapp, twilio_token: event.target.value })} className={inputClass} required />
                      </div>
                      <div>
                        <label htmlFor="twilio-from" className="mb-2 block text-sm font-medium">Número do WhatsApp Twilio</label>
                        <input id="twilio-from" value={whatsapp.phone_from} onChange={(event) => setWhatsapp({ ...whatsapp, phone_from: event.target.value })} placeholder="+14155238886" className={inputClass} required />
                      </div>
                      <div>
                        <label htmlFor="whatsapp-to" className="mb-2 block text-sm font-medium">O teu número de WhatsApp</label>
                        <input id="whatsapp-to" type="tel" value={phoneNumber || whatsapp.phone_to} onChange={(event) => { setPhoneNumber(event.target.value); setWhatsapp({ ...whatsapp, phone_to: event.target.value }); }} placeholder="+351 912 345 678" className={inputClass} required />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" checked={scanOnFinish} onChange={(event) => setScanOnFinish(event.target.checked)} className="mt-0.5 accent-indigo-500" />
                      <span><span className="font-medium">Fazer uma varredura agora</span><span className="mt-1 block text-xs text-slate-500">Procura projetos recentes assim que terminares.</span></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" checked={monitoringEnabled} onChange={(event) => setMonitoringEnabled(event.target.checked)} className="mt-0.5 accent-indigo-500" />
                      <span><span className="font-medium">Manter a monitorização ativa</span><span className="mt-1 block text-xs text-slate-500">Verificações automáticas a cada 15 minutos enquanto o servidor estiver ligado.</span></span>
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0 || isSaving}
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:invisible"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                {step < 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 0 && !displayName.trim()) {
                        setBanner({ type: "error", text: "Diz-nos como podemos chamar-te." });
                        return;
                      }
                      if (step === 1 && !ownerUsername.trim()) {
                        setBanner({ type: "error", text: "Indica o teu nome de usuário do GitHub." });
                        return;
                      }
                      setBanner(null);
                      setStep(step + 1);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Continuar <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {isSaving ? "A guardar..." : "Guardar e continuar"}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}

      {rateLimitDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="github-rate-limit-title"
            className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Clock3 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Limite temporário</p>
                  <h2 id="github-rate-limit-title" className="mt-1 text-xl font-bold text-slate-900">
                    O GitHub pediu uma pausa
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRateLimitDialog(null)}
                aria-label="Fechar aviso"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-5 text-sm leading-6 text-slate-600">
              Foram feitas muitas consultas à API do GitHub em pouco tempo. Isto não significa necessariamente que o teu
              usuário ou token estejam errados.
            </p>

            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <Clock3 className="h-4 w-4" /> Opção A — aguardar
                </h3>
                <p className="mt-2 text-sm leading-5 text-amber-900/80">
                  {rateLimitDialog.retryAfterMinutes
                    ? `Aguarda cerca de ${rateLimitDialog.retryAfterMinutes} minuto(s) antes de tentar novamente.`
                    : "Aguarda alguns minutos antes de tentar novamente. O tempo exato depende do limite aplicado pelo GitHub; a cota principal pode demorar até 60 minutos a renovar."}
                </p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                  <KeyRound className="h-4 w-4" /> Opção B — adicionar um token pessoal
                </h3>
                <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-5 text-indigo-950/80">
                  <li>
                    <a
                      href="https://github.com/settings/tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
                    >
                      Cria um token pessoal no GitHub
                    </a>{" "}
                    para acesso a repositórios públicos.
                  </li>
                  <li>Volta à aplicação e abre a etapa 2, «GitHub».</li>
                  <li>Cola o token no campo «Token de acesso GitHub» e guarda as configurações.</li>
                </ol>
                <p className="mt-3 text-xs leading-5 text-indigo-900/70">
                  Mantém o token privado. Com autenticação, o limite costuma ser maior; se a cota também se esgotar,
                  será necessário aguardar a renovação.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRateLimitDialog(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Entendi
              </button>
              <button
                type="button"
                onClick={openGithubTokenSettings}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Configurar token na aplicação
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
