"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface Stats {
  year: number;
  total: number;
  byMonth: { month: number; label: string; total: number; morning: number; afternoon: number }[];
  byPro: { name: string; total: number }[];
  bySede: { name: string; total: number }[];
  byReason: { name: string; total: number }[];
}

export default function StatsTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/company/stats?year=${year}`)
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (alive) setStats(s); })
      .catch(() => { if (alive) setStats(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [year]);

  const CHART_H = 200;

  return (
    <div className="h-full overflow-auto pr-1 space-y-4 animate-[fadeIn_.25s_ease-out]">
      {/* Cabecera */}
      <div className="flex items-center gap-3 flex-wrap bg-slate-800/50 border border-slate-700 rounded-xl p-3">
        <h2 className="text-white font-black text-base">📊 Datos de avisos</h2>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-xs">
          {Array.from({ length: 6 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {stats && (
          <span className="text-xs font-bold text-[#6BBE7A]">
            {stats.total} aviso(s) en {year}
          </span>
        )}
        {loading && <span className="text-xs text-slate-400">Cargando…</span>}
      </div>

      {!stats && !loading && (
        <div className="text-center text-slate-500 text-sm py-10">Sin datos para {year}.</div>
      )}

      {stats && (
        <>
          {/* Por mes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <h3 className="text-xs font-extrabold text-blue-400 uppercase mb-2">Avisos por mes</h3>
            <div style={{ width: "100%", height: CHART_H }}>
              <ResponsiveContainer>
                <BarChart data={stats.byMonth} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="morning" name="Mañana" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="afternoon" name="Tarde" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Por profesional */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
              <h3 className="text-xs font-extrabold text-blue-400 uppercase mb-2">Por profesional (top 12)</h3>
              {stats.byPro.length === 0 ? (
                <p className="text-slate-500 text-xs py-6 text-center">Sin avisos este año.</p>
              ) : (
                <div style={{ width: "100%", height: Math.max(CHART_H, stats.byPro.length * 26) }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.byPro} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={64} tick={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 700 }} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                      <Bar dataKey="total" name="Avisos" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Por sede */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
              <h3 className="text-xs font-extrabold text-blue-400 uppercase mb-2">Por sede</h3>
              {stats.bySede.length === 0 ? (
                <p className="text-slate-500 text-xs py-6 text-center">Sin avisos este año.</p>
              ) : (
                <div style={{ width: "100%", height: Math.max(CHART_H, stats.bySede.length * 26) }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.bySede} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 700 }} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                      <Bar dataKey="total" name="Avisos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Por motivo: chips rápidos */}
          {stats.byReason.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
              <h3 className="text-xs font-extrabold text-blue-400 uppercase mb-2">Por motivo</h3>
              <div className="flex flex-wrap gap-2">
                {stats.byReason.map(r => (
                  <span key={r.name} className="bg-red-700/70 border border-red-400 text-red-100 rounded-lg px-3 py-1.5 text-xs font-black">
                    {r.name} · {r.total}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
