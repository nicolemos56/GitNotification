/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { FolderGit2, ExternalLink, Calendar, Layers, Sparkles, Trash2, Send } from "lucide-react";
import { ProcessedRepository } from "../types";

interface LiveFeedProps {
  repositories: ProcessedRepository[];
  onClearFeed: () => Promise<any>;
}

export default function LiveFeed({ repositories, onClearFeed }: LiveFeedProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleClear = async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    await onClearFeed();
    setIsConfirming(false);
  };

  return (
    <div className="space-y-4" id="live-feed">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Eventos Detetados e Notificados</h3>
            <p className="text-xs text-slate-400">Linha temporal com relatórios da IA e o estado do envio das notificações</p>
          </div>
        </div>

        {repositories.length > 0 && (
          <div className="flex items-center gap-2">
            {isConfirming ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  className="text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 text-white bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  id="btn-clear-feed-confirm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar Limpeza</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 text-[11px] font-semibold px-3 py-1.5 rounded-xl hover:bg-rose-500/5 transition-all cursor-pointer"
                id="btn-clear-feed"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-450" />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3.5">
        {repositories.map((repo) => {
          const techList = repo.tech_stack ? repo.tech_stack.split(",").map(t => t.trim()) : [];

          return (
            <div
              key={repo.id}
              className="border border-slate-800/80 rounded-2xl p-5 transition-all bg-slate-900/60 hover:border-indigo-500/25 relative overflow-hidden"
              id={`repo-item-${repo.id}`}
            >
              {/* Vertical accent colored by its channel dispatch */}
              <div 
                className={`absolute top-0 left-0 w-1 h-full ${
                  repo.channel_used === "Telegram" 
                    ? "bg-sky-500" 
                    : repo.channel_used === "WhatsApp"
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                }`} 
              />

              <div className="flex flex-wrap items-start justify-between gap-2 pl-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[10.5px] text-slate-400 font-mono">
                    <span className="font-semibold text-indigo-400">@{repo.owner_username}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(repo.detected_at).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                    {repo.repo_name}
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-indigo-400 transition-colors inline-flex"
                      title="Abrir no GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </h4>
                </div>

                {/* Dispatch Status Badge */}
                <div>
                  {repo.notification_sent ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold font-mono border ${
                      repo.channel_used === "Telegram"
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>
                      <Send className="w-3 h-3" />
                      {repo.channel_used} Enviado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-slate-950 text-slate-500 text-[10px] px-2.5 py-0.5 rounded-full font-semibold border border-slate-800 font-mono">
                      Apenas Local
                    </span>
                  )}
                </div>
              </div>

              {techList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pl-1.5">
                  {techList.map((tech) => (
                    <span 
                      key={tech} 
                      className="bg-slate-950 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-850"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {/* Pure AI summary with streamlined UI */}
              <div className="mt-3.5 bg-slate-950 border border-slate-850/65 rounded-xl p-4 pl-4">
                <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest font-mono">
                    Análise Automatizada de Código
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {repo.ai_summary}
                </p>
              </div>

            </div>
          );
        })}

        {repositories.length === 0 && (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 space-y-2 bg-slate-900/10">
            <FolderGit2 className="w-8 h-8 mx-auto opacity-30 text-indigo-400" />
            <div>
              <p className="text-sm font-semibold text-slate-400">Histórico Vazio</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                Nenhum novo repositório detetado ou simulado ainda. Ligue a sua conta ou dispare uma simulação rápida de teste.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
