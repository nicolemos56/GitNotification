/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Terminal } from "lucide-react";
import { LogItem } from "../types";

interface LogConsoleProps {
  logs: LogItem[];
}

export default function LogConsole({ logs }: LogConsoleProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3" id="log-console">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-950 text-slate-400 rounded-lg border border-slate-800">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Consola de Automação (Atividade)</h3>
            <p className="text-xs text-slate-400">Varreduras e sincronizações em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider uppercase">Ativo</span>
        </div>
      </div>

      <div className="bg-slate-950 rounded-xl p-4 font-mono text-[10.5px] leading-relaxed select-all border border-slate-850 h-[150px] overflow-y-auto space-y-1.5">
        {logs.map((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString("pt-PT", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });

          let levelColor = "text-sky-400";
          let badgeText = "info";

          if (log.level === "success") {
            levelColor = "text-emerald-400 font-bold";
            badgeText = "ok";
          } else if (log.level === "warn") {
            levelColor = "text-amber-500";
            badgeText = "warn";
          } else if (log.level === "error") {
            levelColor = "text-rose-500 font-bold";
            badgeText = "err";
          } else if (log.level === "ai") {
            levelColor = "text-indigo-400 font-bold";
            badgeText = "ai";
          }

          return (
            <div key={index} className="flex items-start gap-1 pb-1 border-b border-slate-900/40 last:border-0 hover:bg-slate-900/10 transition-colors">
              <span className="text-slate-600 shrink-0 select-none">[{time}]</span>
              <span className={`shrink-0 select-none font-bold mr-1 ${levelColor}`}>
                [{badgeText.toUpperCase()}]
              </span>
              <span className="text-slate-300 break-all">{log.message}</span>
            </div>
          );
        })}

        {logs.length === 0 && (
          <p className="text-slate-600 italic text-center py-8">Aguardando registos...</p>
        )}
      </div>
    </div>
  );
}
