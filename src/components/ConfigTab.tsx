"use client";

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — ahora solo contiene 🔔 AVISOS PROGRAMADOS.
// (Los accesos y permisos se gestionan en MI EMPRESA → Accesos · Permisos;
//  el panel de Envíos y Auditoría se eliminó a petición del usuario.)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

// ───────────────────────────────────────────────────────────
// AVISOS PROGRAMADOS — cuando en las NOTAS de una tarjeta/aviso
// aparece una palabra y faltan X días → notificación al móvil.
// ───────────────────────────────────────────────────────────

interface AlertRule {
  id: string;
  keyword: string;
  daysBefore: number;
  enabled: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export default function ConfigTab() {
  return (
    <div className="space-y-4">
      <AlertRulesPanel />
    </div>
  );
}

function AlertRulesPanel() {
  const [open, setOpen] = useState(true);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [days, setDays] = useState("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Estado de las notificaciones en ESTE dispositivo
  const [notif, setNotif] = useState<"checking" | "unsupported" | "denied" | "off" | "subscribed">("checking");

  const load = async () => {
    try {
      const res = await fetch("/api/company/alert-rules");
      if (res.ok) setRules(await res.json());
    } catch { /* noop */ }
  };

  const checkNotif = async () => {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setNotif("unsupported");
        return;
      }
      const perm = Notification.permission;
      if (perm === "denied") { setNotif("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setNotif(sub && perm === "granted" ? "subscribed" : "off");
    } catch {
      setNotif("off");
    }
  };

  useEffect(() => { if (open) { load(); checkNotif(); } }, [open]);

  const enableNotif = async () => {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotif("denied");
        setMsg("⛔ Permiso de notificaciones denegado. Actívalo en los ajustes del navegador.");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/company/push/public-key");
      if (!keyRes.ok) throw new Error("sin clave");
      const { publicKey } = await keyRes.json();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const res = await fetch("/api/company/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("fallo guardado");
      setNotif("subscribed");
      setMsg("✅ Notificaciones activadas en este dispositivo");
    } catch {
      setMsg("⚠️ No se pudo activar. En iPhone: añade primero la app a la pantalla de inicio (Compartir → Añadir a inicio) y vuelve aquí.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/company/push/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? `📤 Prueba enviada a ${j.sent} dispositivo(s)` : (j.error || "Error al enviar"));
    } catch { setMsg("Error de conexión"); } finally { setBusy(false); }
  };

  const addRule = async () => {
    if (!keyword.trim()) { setMsg("Escribe la palabra o texto a vigilar"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/company/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, daysBefore: parseInt(days, 10) || 1 }),
      });
      if (res.ok) {
        setKeyword("");
        setDays("1");
        await load();
        setMsg("✅ Aviso programado creado");
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error || "Error al crear");
      }
    } catch { setMsg("Error de conexión"); } finally { setBusy(false); }
  };

  const toggleRule = async (r: AlertRule) => {
    setRules(prev => prev.map(x => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    await fetch(`/api/company/alert-rules/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    }).catch(() => {});
  };

  const deleteRule = async (r: AlertRule) => {
    if (!confirm(`¿Borrar el aviso programado «${r.keyword}»?`)) return;
    setRules(prev => prev.filter(x => x.id !== r.id));
    await fetch(`/api/company/alert-rules/${r.id}`, { method: "DELETE" }).catch(() => {});
  };

  const notifLabel = {
    checking: "Comprobando…",
    unsupported: "Este navegador no soporta notificaciones push",
    denied: "⛔ Notificaciones BLOQUEADAS en este navegador (ajustes del navegador)",
    off: "Notificaciones NO activadas en este dispositivo",
    subscribed: "✅ Notificaciones ACTIVADAS en este dispositivo",
  }[notif];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="text-2xl">🔔</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-white text-sm">Avisos programados (notificación al móvil)</span>
          <span className="block text-xs text-slate-400">Cuando en las NOTAS de una tarjeta o aviso salga una palabra, te avisamos X días antes de la fecha.</span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* ── 0) Cómo funciona ── */}
          <div className="bg-slate-900/60 border border-blue-600/30 rounded-lg p-3 space-y-1.5">
            <div className="text-[11px] font-extrabold text-blue-400 uppercase">¿Cómo funciona? ¿A qué móvil llega y qué mensaje?</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">📱 ¿A qué móvil llega?</span> A TODOS los móviles y PC donde se haya pulsado
              <span className="font-bold text-[#6BBE7A]"> 🔔 ACTIVAR AQUÍ</span> (cada dispositivo queda registrado al pulsar el botón).
              No se elige un móvil concreto: se avisa a todos los registrados de la clínica a la vez.
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">📝 ¿Qué mensaje?</span> Ejemplo: <span className="text-amber-400 font-bold">«CIRUGÍA — MAÑANA»</span> y debajo
              la fecha (dd/mm/aaaa), la sede, el turno (Mañana/Tarde) y el texto de la nota de la tarjeta. Cada tarjeta se avisa UNA sola vez (no se repite días siguientes).
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">⏰ ¿Cuándo?</span> Cada día a las 10:00 (hora España) la app revisa las tarjetas y avisos:
              si su nota contiene la palabra y faltan los días que indiques (o menos), envía la notificación.
            </p>
          </div>

          {/* ── 1) Notificaciones en este dispositivo ── */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="text-[11px] font-extrabold text-blue-400 uppercase">1 · Notificaciones en este móvil / PC</div>
            <p className={`text-xs font-bold ${notif === "subscribed" ? "text-[#6BBE7A]" : notif === "denied" || notif === "unsupported" ? "text-red-400" : "text-amber-400"}`}>
              {notifLabel}
            </p>
            <div className="flex gap-2 flex-wrap">
              {notif !== "subscribed" && notif !== "unsupported" && (
                <button onClick={enableNotif} disabled={busy}
                  className="bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-xs font-black px-3 py-2 rounded-lg transition">
                  🔔 ACTIVAR AQUÍ
                </button>
              )}
              <button onClick={sendTest} disabled={busy || notif !== "subscribed"}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
                title="Enviar una notificación de prueba a todos los dispositivos">
                📤 ENVIAR PRUEBA
              </button>
            </div>
            {msg && <p className="text-[11px] text-amber-400 font-bold">{msg}</p>}
          </div>

          {/* ── 2) Crear aviso programado ── */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="text-[11px] font-extrabold text-blue-400 uppercase">2 · Crear aviso programado</div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Escribe la palabra que debe aparecer en la NOTA de una tarjeta o aviso y cuántos días antes avisar. Puedes crear tantos como quieras.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="Palabra o texto en notas (p. ej. REUNIÓN)"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Avisar</span>
                <input
                  type="number" min={0} max={365} value={days}
                  onChange={e => setDays(e.target.value)}
                  className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center"
                />
                <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">días antes</span>
              </div>
              <button onClick={addRule} disabled={busy}
                className="bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-xs font-black px-4 py-2 rounded-lg transition whitespace-nowrap">
                ➕ AÑADIR
              </button>
            </div>
          </div>

          {/* ── 3) Lista de avisos programados ── */}
          <div className="space-y-1">
            {rules.length === 0 && (
              <p className="text-xs text-slate-500 py-3 text-center">No hay avisos programados todavía.</p>
            )}
            {rules.map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${r.enabled ? "bg-[#6BBE7A]" : "bg-slate-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white truncate">“{r.keyword}”</div>
                  <div className="text-[10px] text-slate-400">
                    Avisa {r.daysBefore === 0 ? "el mismo día" : `${r.daysBefore} día(s) antes`} · {r.enabled ? "activo" : "pausado"}
                  </div>
                </div>
                <button
                  onClick={() => toggleRule(r)}
                  className={`shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition ${r.enabled ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white"}`}
                  title={r.enabled ? "Pausar este aviso" : "Reactivar este aviso"}
                >
                  {r.enabled ? "⏸ PAUSAR" : "▶ ACTIVAR"}
                </button>
                <button
                  onClick={() => deleteRule(r)}
                  className="shrink-0 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold w-8 h-8 rounded-lg transition"
                  title="Borrar este aviso programado"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
