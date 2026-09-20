"use client";

// ═══════════════════════════════════════════════════════════
// PUSH ONBOARD — como el MICRÓFONO: al ENTRAR en la app se
// pregunta una sola vez "¿recibir avisos en este móvil?".
// Un toque en 🔔 ACTIVAR → sale el permiso del sistema → listo.
// (Los navegadores exigen que el permiso se pida tras un toque,
//  igual que pasa con el micrófono: por eso es un botón, no automático.)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

function b64ToUint8(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

type Mode = "hidden" | "ask" | "ios-instructions";
const DAY = 24 * 3600 * 1000;

export default function PushOnboard() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);
  const [inline, setInline] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(async () => {
      try {
        const ua = navigator.userAgent || "";
        const ios = /iphone|ipad|ipod/i.test(ua)
          || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
          || (navigator as unknown as { standalone?: boolean }).standalone === true;
        const now = Date.now();

        // iPhone DENTRO de Safari: el push no existe ahí → instrucción clara (cada 2 días)
        if (ios && !standalone) {
          const snooze = parseInt(localStorage.getItem("pushIosSnooze") || "0", 10);
          if (now - snooze > 2 * DAY) setMode("ios-instructions");
          return;
        }
        if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return;
        // Ya concedido o bloqueado → no molestar (ConfigTab explica el reset)
        if (Notification.permission !== "default") return;
        const snooze = parseInt(localStorage.getItem("pushAskSnooze") || "0", 10);
        if (now - snooze < 7 * DAY) return;
        // ¿Ya suscrito en este dispositivo?
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) return;
        } catch { /* seguimos */ }
        setMode("ask");
      } catch { /* noop */ }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const activate = async () => {
    setBusy(true); setInline("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        localStorage.setItem("pushAskSnooze", String(Date.now()));
        setMode("hidden");
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
          applicationServerKey: b64ToUint8(publicKey) as BufferSource,
        });
      }
      const res = await fetch("/api/company/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("fallo guardado");
      setToast("✅ ¡LISTO! Este móvil ya recibe avisos.");
      setTimeout(() => setToast(""), 6000);
      setMode("hidden");
    } catch {
      setInline("⚠️ No se pudo completar aquí. Abre MURAL desde el icono de la pantalla de inicio y vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  };

  const snooze = (key: string, days: number) => {
    localStorage.setItem(key, String(Date.now()));
    setMode("hidden");
  };

  if (mode === "hidden" && !toast) return null;

  return (
    <>
      {toast && (
        <div className="fixed bottom-24 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-[60] bg-emerald-600 text-white rounded-xl shadow-2xl px-4 py-3 text-sm font-black text-center">
          {toast}
        </div>
      )}
      {mode !== "hidden" && (
        <div className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-slate-900 border-2 border-[#6BBE7A] rounded-2xl shadow-2xl p-4 space-y-2">
          {mode === "ask" && (
            <>
              <div className="flex items-start gap-2">
                <span className="text-2xl shrink-0">🔔</span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white leading-snug">¿Recibir AVISOS de la agenda en este móvil?</p>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Como el micrófono: se pregunta al entrar, UNA sola vez. Toca ACTIVAR y pulsa <b className="text-slate-300">Permitir</b>.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={activate} disabled={busy}
                  className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-sm font-black py-2.5 rounded-xl transition">
                  {busy ? "ACTIVANDO…" : "🔔 ACTIVAR"}
                </button>
                <button onClick={() => snooze("pushAskSnooze", 7)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl transition">
                  AHORA NO
                </button>
              </div>
              {inline && <p className="text-[11px] text-amber-400 font-bold leading-snug">{inline}</p>}
            </>
          )}
          {mode === "ios-instructions" && (
            <>
              <p className="text-sm font-black text-amber-400 leading-snug">📱 Para que los AVISOS lleguen a este iPhone:</p>
              <ol className="text-[11px] text-slate-300 leading-snug list-decimal ml-4 space-y-0.5">
                <li>Compartir ⬆️ → <b className="text-white">Añadir a inicio</b></li>
                <li>Abre MURAL <b className="text-white">desde el icono nuevo</b> 📲</li>
                <li>Al entrar te preguntará, igual que el micrófono → <b className="text-white">Permitir</b></li>
              </ol>
              <button onClick={() => snooze("pushIosSnooze", 2)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 rounded-xl transition">
                ENTENDIDO
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
