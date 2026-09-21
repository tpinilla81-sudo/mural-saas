"use client";

// ═══════════════════════════════════════════════════════════
// CENTRO DE NOTIFICACIONES de la barra superior:
//  🔔 CAMPANA = interruptor de los avisos EN ESTE DISPOSITIVO.
//     · Activada  → campana normal (llegan los avisos)
//     · Desactivada → campana TACHADA CON RAYA ROJA (no llega nada)
//     · Un toque la activa / la desactiva.
//  📩 SOBRE (al lado) = bandeja de mensajes. Lleva el NÚMERO de
//     no leídos en pequeño encima. Al pulsarlo se leen todos y
//     el contador se limpia. Cada mensaje abre su aviso.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";

type BellState = "checking" | "on" | "off" | "none";
interface InboxMsg {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationCenter({ showInbox, bare = false }: { showInbox: boolean; bare?: boolean }) {
  const [bell, setBell] = useState<BellState>("checking");
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<InboxMsg[]>([]);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  // ── CAMPANA: estado real de ESTE dispositivo ──
  const evalBell = useCallback(async () => {
    try {
      if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
        setBell("none");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub || Notification.permission !== "granted") {
        setBell("none");
        return;
      }
      const res = await fetch(`/api/company/push/state?endpoint=${encodeURIComponent(sub.endpoint)}`);
      if (!res.ok) {
        setBell("none");
        return;
      }
      const j = await res.json();
      setBell(j.exists ? (j.enabled ? "on" : "off") : "none");
    } catch {
      setBell("none");
    }
  }, []);

  useEffect(() => {
    evalBell();
    const h = () => { evalBell(); };
    window.addEventListener("push-state:changed", h);
    return () => window.removeEventListener("push-state:changed", h);
  }, [evalBell]);

  const toggleBell = async () => {
    if (bell === "checking") return;
    if (bell === "none") {
      // Sin activar aquí → abrimos el asistente (instrucciones iPhone incluidas)
      window.dispatchEvent(new Event("push-onboard:open"));
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setBell("none");
        return;
      }
      const next = bell !== "on"; // on→off / off→on
      const res = await fetch("/api/company/push/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, enabled: next }),
      });
      if (res.ok) setBell(next ? "on" : "off");
    } catch { /* noop */ }
  };

  // ── SOBRE: contador + bandeja ──
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/company/inbox");
      if (!res.ok) return;
      const j = await res.json();
      setUnread(j.unread || 0);
      if (openRef.current) setMessages(j.messages || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!showInbox) return;
    refresh();
    const iv = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("inbox:refresh", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("inbox:refresh", onFocus);
    };
  }, [showInbox, refresh]);

  const openInbox = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    try {
      const res = await fetch("/api/company/inbox");
      if (res.ok) {
        const j = await res.json();
        setMessages(j.messages || []);
        if ((j.unread || 0) > 0) {
          setUnread(0); // al abrir el sobre se LEEN → el contador se limpia
          fetch("/api/company/inbox/read", { method: "POST" }).catch(() => {});
        }
      }
    } catch { /* noop */ }
  };

  const openMessage = (m: InboxMsg) => {
    if (!m.readAt) {
      fetch("/api/company/inbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [m.id] }),
      }).catch(() => {});
    }
    if (m.url && m.url !== "/") {
      setOpen(false);
      window.location.href = m.url; // abre la app EN ese aviso (deep-link)
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const btnCls = bare
    ? "relative text-white p-2 text-lg transition"
    : "relative bg-slate-700 hover:bg-slate-600 text-white w-9 h-9 rounded-lg text-base transition flex items-center justify-center";

  const bellDisabled = bell === "off" || bell === "none";

  return (
    <>
      {/* 🔔 CAMPANA — interruptor de notificaciones de este dispositivo */}
      <button onClick={toggleBell} className={btnCls} title={
        bell === "on"
          ? "Avisos ACTIVADOS en este móvil — toca para DESACTIVARLOS"
          : bell === "off"
            ? "Avisos DESACTIVADOS en este móvil — toca para ACTIVARLOS"
            : "Activa los avisos en este móvil"
      }>
        <span className="relative inline-flex items-center justify-center">
          <span className={bellDisabled ? "opacity-60" : ""}>🔔</span>
          {bellDisabled && (
            <span className="absolute w-[150%] max-w-[26px] h-[3px] bg-red-500 rounded-full rotate-45 shadow-[0_0_3px_rgba(0,0,0,0.8)]" />
          )}
        </span>
      </button>

      {/* 📩 SOBRE — bandeja de mensajes con contador de no leídos */}
      {showInbox && (
        <button onClick={openInbox} className={btnCls} title="Mensajes: pulsa para leerlos">
          📩
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center border border-black/60 shadow">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Panel de la bandeja */}
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="fixed z-[60] top-16 left-2 right-2 sm:left-auto sm:right-4 sm:w-96 max-h-[70vh] overflow-y-auto bg-slate-900 border-2 border-[#6BBE7A] rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <span className="text-sm font-black text-white">📩 Mensajes</span>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg leading-none" title="Cerrar">✕</button>
            </div>
            {messages.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-400 text-center leading-snug">
                Sin mensajes todavía.
                <br />Los avisos que se te envíen quedarán aquí aunque la campana esté desactivada.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {messages.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => openMessage(m)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-slate-800/60 transition ${!m.readAt ? "border-l-4 border-[#6BBE7A]" : "border-l-4 border-transparent"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[13px] leading-snug ${!m.readAt ? "font-black text-white" : "font-bold text-slate-300"}`}>
                          {m.title || "Aviso"}
                        </span>
                        <span className="text-[9px] text-slate-500 shrink-0 pt-0.5">{fmtDate(m.createdAt)}</span>
                      </div>
                      {m.body && <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{m.body}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
