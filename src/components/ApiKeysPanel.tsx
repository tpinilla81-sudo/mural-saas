"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const BASE = typeof window !== "undefined" ? window.location.origin : "https://mural-saas.vercel.app";

export default function ApiKeysPanel() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err" | "">("");
  const [newLabel, setNewLabel] = useState("Claude admin");
  const [newKey, setNewKey] = useState<string | null>(null); // la key recién creada (se muestra 1 vez)
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/company/apikeys");
      if (r.ok) setKeys(await r.json());
    } catch {}
  };

  useEffect(() => { if (open && keys.length === 0) load(); }, [open]);

  const notify = (type: "ok" | "err", text: string) => {
    setMsgType(type); setMsg(text);
    setTimeout(() => { setMsg(""); setMsgType(""); }, 10000);
  };

  const createKey = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/company/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel || "Claude admin", scope: "read,write" }),
      });
      const body = await r.json();
      if (!r.ok) { notify("err", "❌ " + (body.error || "No se pudo crear")); return; }
      setNewKey(body.key);
      notify("ok", "✅ API key creada. Cópiala ahora — no se volverá a mostrar.");
      await load();
    } catch (e: any) { notify("err", "❌ " + (e?.message || String(e))); }
    finally { setBusy(false); }
  };

  const revokeKey = async (id: string, label: string) => {
    if (!confirm(`¿Revocar la API key "${label}"? Claude ya no podrá usarla.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/company/apikeys?id=${id}`, { method: "DELETE" });
      if (!r.ok) { const b = await r.json(); notify("err", "❌ " + (b.error || "No se pudo revocar")); return; }
      await load();
    } catch (e: any) { notify("err", "❌ " + (e?.message || String(e))); }
    finally { setBusy(false); }
  };

  const copyKey = async (k: string) => {
    try {
      await navigator.clipboard.writeText(k);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const curlExample = newKey
    ? `curl -H "Authorization: Bearer ${newKey}" ${BASE}/api/mcp/whoami`
    : `curl -H "Authorization: Bearer mur_live_..." ${BASE}/api/mcp/whoami`;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="text-2xl">🤖</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-white text-sm">Conectar con Claude / IA</span>
          <span className="block text-xs text-slate-400">Genera una API key para que Claude pueda consultar turnos y crear avisos por chat</span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {msg && (
            <div className={`text-xs font-bold rounded p-2 ${msgType === "ok" ? "bg-emerald-900/30 text-emerald-300 border border-emerald-700/40" : "bg-red-900/30 text-red-300 border border-red-700/40"}`}>
              {msg}
            </div>
          )}

          {/* Nueva key recién creada — mostrar UNA vez */}
          {newKey && (
            <div className="bg-amber-900/20 border-2 border-amber-500 rounded-lg p-3 space-y-2">
              <div className="text-xs font-black text-amber-300 uppercase">⚠️ Copia tu API key ahora</div>
              <p className="text-[11px] text-amber-200 font-bold">No se volverá a mostrar. Si la pierdes, tendrás que revocarla y crear otra.</p>
              <div className="flex gap-2">
                <input readOnly value={newKey} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-amber-300 font-mono" />
                <button onClick={() => copyKey(newKey)} className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-3 py-1.5 rounded">
                  {copied ? "✓ Copiada" : "📋 Copiar"}
                </button>
              </div>
              <div className="text-[10px] text-amber-200 font-mono bg-slate-900/50 rounded p-2 break-all">
                {curlExample}
              </div>
            </div>
          )}

          {/* Crear nueva */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="text-xs font-black text-slate-300 uppercase">Crear nueva API key</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Etiqueta (ej. Claude admin)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
              />
              <button onClick={createKey} disabled={busy}
                className="bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-xs font-black px-4 py-1.5 rounded">
                🤖 CREAR
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Permisos: <b className="text-slate-400">read, write</b> (consultar y crear turnos/avisos)</p>
          </div>

          {/* Listado de keys existentes */}
          <div>
            <div className="text-xs font-black text-slate-300 uppercase mb-1">API keys activas ({keys.length})</div>
            {keys.length === 0 && (
              <p className="text-xs text-slate-500 italic py-2 text-center">Aún no hay API keys. Crea una para conectar Claude.</p>
            )}
            <div className="space-y-1.5">
              {keys.map(k => (
                <div key={k.id} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">🔑</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{k.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {k.prefix}…{k.scope} · {k.lastUsedAt ? `usada ${new Date(k.lastUsedAt).toLocaleDateString("es-ES")}` : "sin usar"}
                      </div>
                    </div>
                    <button onClick={() => revokeKey(k.id, k.label)} disabled={busy}
                      className="text-[10px] font-bold bg-red-600/20 hover:bg-red-600 disabled:opacity-40 text-red-400 hover:text-white px-2.5 py-1.5 rounded transition">
                      Revocar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instrucciones para Claude */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="text-xs font-black text-slate-300 uppercase">¿Cómo conectar con Claude?</div>
            <ol className="text-[11px] text-slate-400 leading-snug list-decimal ml-4 space-y-1">
              <li>Crea una API key arriba y cópiala</li>
              <li>En Claude (claude.ai o Claude Desktop), ve a <b className="text-slate-200">Settings → Connectors</b></li>
              <li>Añade un <b className="text-slate-200">Custom Connector</b> con esta URL base: <code className="text-amber-300 font-mono">{BASE}/api/mcp</code></li>
              <li>Pega tu API key en el campo <b className="text-slate-200">Authorization</b>: <code className="text-amber-300 font-mono">Bearer mur_live_…</code></li>
              <li>Prueba diciendo: <i>"Crea un aviso de vacaciones para AS en VIT del 20 al 25 de octubre"</i></li>
            </ol>
            <div className="text-[10px] text-slate-500 font-mono bg-slate-900/50 rounded p-2 break-all">
              {curlExample}
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">
              Los endpoints disponibles: <b className="text-slate-400">/api/mcp/whoami</b> (test), <b className="text-slate-400">/api/mcp/sedes</b>, <b className="text-slate-400">/api/mcp/profesionales</b>, <b className="text-slate-400">/api/mcp/turnos</b> (GET+POST), <b className="text-slate-400">/api/mcp/avisos</b> (GET+POST, soporta rango de fechas con desde/hasta).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
