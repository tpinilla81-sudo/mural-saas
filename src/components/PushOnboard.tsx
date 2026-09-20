"use client";

// ═══════════════════════════════════════════════════════════
// PUSH ONBOARD — como el MICRÓFONO: la app pregunta al entrar.
// REGLA DE ORO: NUNCA se queda callado — si este dispositivo no
// puede recibir avisos, SIEMPRE dice el motivo EXACTO y cómo
// salir del atasco. Además hay un botón 🔔 fijo en la barra
// superior que abre esta ventana cuando el usuario quiera
// (evento window "push-onboard:open").
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

function b64ToUint8(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

type Mode =
  | "hidden"        // ya suscrito: nada que hacer
  | "ask"           // puede activarse YA (toque → prompt del sistema)
  | "ios-home"      // iPhone DENTRO de Safari → añadir a inicio
  | "ios-old"       // iPhone desde el icono pero sin PushManager → iOS 16.4+
  | "ios-denied"    // iPhone standalone con permiso bloqueado
  | "nopush";       // sin soporte push (navegador raro) → Chrome/Edge

interface EnvInfo {
  ios: boolean;
  standalone: boolean;
  hasPush: boolean;
  perm: "default" | "granted" | "denied" | "unknown";
  subscribed: boolean;
}

const DAY = 24 * 3600 * 1000;
const SNOOZE: Record<Exclude<Mode, "hidden">, [key: string, days: number]> = {
  ask: ["pushSnoozeAsk", 3],
  "ios-home": ["pushSnoozeIosHome", 1],
  "ios-old": ["pushSnoozeIosOld", 3],
  "ios-denied": ["pushSnoozeIosDenied", 3],
  nopush: ["pushSnoozeNopush", 7],
};

async function evaluate(): Promise<EnvInfo> {
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const hasPush = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  let perm: EnvInfo["perm"] = "unknown";
  let subscribed = false;
  if (hasPush) {
    try {
      perm = Notification.permission;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!(sub && perm === "granted");
    } catch { /* noop */ }
  }
  return { ios, standalone, hasPush, perm, subscribed };
}

function decide(e: EnvInfo): Mode {
  if (e.subscribed) return "hidden";
  if (e.ios && !e.standalone) return "ios-home";
  if (e.ios && e.standalone && !e.hasPush) return "ios-old";
  if (e.ios && e.standalone && e.perm === "denied") return "ios-denied";
  if (!e.hasPush) return "nopush";
  return "ask"; // default o granted-sin-suscripción
}

export default function PushOnboard() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [asModal, setAsModal] = useState(false); // abierto manualmente con 🔔
  const [busy, setBusy] = useState(false);
  const [inline, setInline] = useState("");
  const [toast, setToast] = useState("");
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null);

  // ── Mostrar un modo concreto (manual ignora snooze) ──
  const open = useCallback(async (manual: boolean) => {
    try {
      const e = await evaluate();
      setEnvInfo(e);
      const m = decide(e);
      if (m === "hidden") {
        if (manual) setToast("✅ Este dispositivo YA recibe avisos.");
        setTimeout(() => setToast(""), 5000);
        setMode("hidden");
        return;
      }
      if (!manual) {
        const [key, days] = SNOOZE[m];
        const snooze = parseInt(localStorage.getItem(key) || "0", 10);
        if (Date.now() - snooze < days * DAY) return; // ya se mostró hace poco
      }
      setInline("");
      setAsModal(manual);
      setMode(m);
    } catch { /* noop */ }
  }, []);

  // Auto: 2,5 s tras entrar, como el micrófono
  useEffect(() => {
    const t = setTimeout(() => { open(false); }, 2500);
    return () => clearTimeout(t);
  }, [open]);

  // Botón 🔔 de la barra superior
  useEffect(() => {
    const h = () => { open(true); };
    window.addEventListener("push-onboard:open", h);
    return () => window.removeEventListener("push-onboard:open", h);
  }, [open]);

  const activate = async () => {
    setBusy(true); setInline("");
    try {
      if (!("Notification" in window) || !("PushManager" in window)) {
        setMode(await reopenIosMode());
        setBusy(false);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setInline(perm === "denied"
          ? "⛔ Has pulsado «No permitir». Para revertirlo: borra el icono de inicio y vuelve a añadirlo."
          : "Sin permiso no puede llegar nada. Vuelve a tocar ACTIVAR y pulsa «Permitir».");
        setBusy(false);
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
      setMode("hidden"); setAsModal(false);
    } catch {
      setInline("⚠️ No se pudo completar. Abre MURAL desde el icono de la pantalla de inicio y toca 🔔 otra vez.");
    } finally {
      setBusy(false);
    }
  };

  const reopenIosMode = async (): Promise<Mode> => {
    const e = await evaluate();
    setEnvInfo(e);
    const m = decide(e);
    setMode(m === "hidden" ? "nopush" : m);
    return m === "hidden" ? "nopush" : m;
  };

  const snoozeAndClose = () => {
    if (mode !== "hidden") {
      const [key] = SNOOZE[mode as Exclude<Mode, "hidden">];
      localStorage.setItem(key, String(Date.now()));
    }
    setMode("hidden"); setAsModal(false);
  };

  if (mode === "hidden" && !toast) return null;

  const box = (
    <div
      className={`${asModal ? "w-full max-w-sm" : "w-full"} relative bg-slate-900 border-2 border-[#6BBE7A] rounded-2xl shadow-2xl p-4 space-y-2`}
    >
      <button
        onClick={() => { setMode("hidden"); setAsModal(false); }}
        className="absolute top-2 right-3 text-slate-500 hover:text-white text-lg leading-none"
        title="Cerrar"
      >✕</button>

      {mode === "ask" && (
        <>
          <div className="flex items-start gap-2">
            <span className="text-2xl shrink-0">🔔</span>
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-snug">¿Recibir AVISOS de la agenda en este móvil?</p>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Como el micrófono: se pregunta al entrar, UNA sola vez. Toca ACTIVAR y pulsa <b className="text-slate-300">Permitir</b>.
                {envInfo?.perm === "granted" && " (ya tienes el permiso: falta registrar el móvil)"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={activate} disabled={busy}
              className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-sm font-black py-2.5 rounded-xl transition">
              {busy ? "ACTIVANDO…" : "🔔 ACTIVAR"}
            </button>
            {!asModal && (
              <button onClick={snoozeAndClose}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl transition">
                AHORA NO
              </button>
            )}
          </div>
        </>
      )}

      {mode === "ios-home" && (
        <>
          <p className="text-sm font-black text-amber-400 leading-snug">📱 Estás DENTRO de Safari: los avisos solo funcionan desde la app de inicio</p>
          <ol className="text-[11px] text-slate-300 leading-snug list-decimal ml-4 space-y-0.5">
            <li>Compartir ⬆️ → <b className="text-white">Añadir a inicio</b> → Añadir</li>
            <li>Cierra Safari y abre MURAL <b className="text-white">desde el icono nuevo</b> 📲</li>
            <li>Al entrar te preguntará, igual que el micrófono → <b className="text-white">Permitir</b></li>
          </ol>
        </>
      )}

      {mode === "ios-old" && (
        <>
          <p className="text-sm font-black text-red-400 leading-snug">📲 Estás en la app de inicio ✓, pero este iPhone NO soporta avisos web</p>
          <p className="text-[11px] text-slate-300 leading-snug">
            Necesitas <b className="text-white">iOS 16.4 o superior</b>:
            <b className="text-white"> Ajustes → General → Actualización de software</b>. Instala la actualización, vuelve a abrir MURAL desde el icono y toca 🔔.
          </p>
        </>
      )}

      {mode === "ios-denied" && (
        <>
          <p className="text-sm font-black text-red-400 leading-snug">⛔ Las notificaciones están BLOQUEADAS en este dispositivo</p>
          <p className="text-[11px] text-slate-300 leading-snug">
            Para resetear el permiso: <b className="text-white">borra el icono de MURAL de la pantalla de inicio, añádelo otra vez</b> (Compartir ⬆️ → Añadir a inicio) y al entrar vuelve a tocar 🔔 → Permitir.
          </p>
        </>
      )}

      {mode === "nopush" && (
        <>
          <p className="text-sm font-black text-amber-400 leading-snug">⚠️ Este navegador no soporta notificaciones</p>
          <p className="text-[11px] text-slate-300 leading-snug">
            En <b className="text-white">Android usa Chrome</b>; en <b className="text-white">PC usa Chrome o Edge</b>. En iPhone: Añadir a inicio y abrir desde el icono.
          </p>
        </>
      )}

      {inline && <p className="text-[11px] text-amber-400 font-bold leading-snug">{inline}</p>}
    </div>
  );

  return (
    <>
      {toast && (
        <div className="fixed bottom-24 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-[80] bg-emerald-600 text-white rounded-xl shadow-2xl px-4 py-3 text-sm font-black text-center">
          {toast}
        </div>
      )}
      {mode !== "hidden" && (asModal ? (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => { setMode("hidden"); setAsModal(false); }}>
          <div onClick={e => e.stopPropagation()}>{box}</div>
        </div>
      ) : (
        <div className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50">{box}</div>
      ))}
    </>
  );
}
