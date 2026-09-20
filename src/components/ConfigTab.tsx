"use client";

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — 🔔 AVISOS AL MÓVIL (versión SIMPLE)
//   ① ACTIVA TU MÓVIL (una sola vez)  →  ② CREA UN AVISO  →  ③ LLEGA SOLO
// Prioridad: que funcione de verdad en el móvil, con instrucciones
// claras de activación (Android / iPhone) siempre visibles.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

interface AlertRule {
  id: string;
  keyword: string;
  daysBefore: number;
  enabled: boolean;
  recipients: string; // CSV de userIds ("": TODOS)
  channel: string;    // push | email | both
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface DeviceRow {
  id: string;
  userId: string | null;
  userName: string;
  userAgent: string;
  createdAt: string;
}

function deviceType(ua: string): string {
  const s = (ua || "").toLowerCase();
  const os = s.includes("android") ? "Android"
    : s.includes("iphone") || s.includes("ipad") ? "iPhone/iPad"
    : s.includes("windows") ? "Windows"
    : s.includes("mac") ? "Mac"
    : s.includes("linux") ? "Linux" : "Dispositivo";
  const br = s.includes("edg/") ? "Edge"
    : s.includes("opr/") || s.includes("opera") ? "Opera"
    : s.includes("chrome") ? "Chrome"
    : s.includes("firefox") ? "Firefox"
    : s.includes("safari") ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
}

type Channel = "push" | "email" | "both";

const CHANNEL_SHORT: Record<Channel, string> = {
  push: "📱 Móvil",
  email: "✉️ Correo",
  both: "📱+✉️",
};

function channelLabel(c: string): string {
  return CHANNEL_SHORT[(c as Channel)] || "📱+✉️";
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

// ── Selector de destinatarios (¿A QUIÉN le llega?) — solo en MÁS OPCIONES ──
function RecipientsPicker({
  users, devices, all, selected, onSetAll, onToggle,
}: {
  users: UserRow[];
  devices: DeviceRow[];
  all: boolean;
  selected: Set<string>;
  onSetAll: (v: boolean) => void;
  onToggle: (id: string) => void;
}) {
  const devCount = new Map<string, number>();
  for (const d of devices) if (d.userId) devCount.set(d.userId, (devCount.get(d.userId) || 0) + 1);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-extrabold text-slate-300 uppercase">¿A quién?</span>
        <span className="text-[10px] text-emerald-400 font-bold">
          {all ? "TODOS" : `${selected.size} elegido(s)`}
        </span>
      </div>
      <div className="flex gap-1 mb-1.5">
        <button type="button" onClick={() => onSetAll(true)}
          className={`flex-1 text-[10px] px-2 py-1.5 rounded font-bold transition ${all ? "bg-emerald-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}>
          TODOS
        </button>
        <button type="button" onClick={() => onSetAll(false)}
          className={`flex-1 text-[10px] px-2 py-1.5 rounded font-bold transition ${!all ? "bg-emerald-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}>
          ELEGIR…
        </button>
      </div>
      {!all && (
        <div className="max-h-[150px] overflow-y-auto bg-slate-900/60 border border-slate-700 rounded p-2 space-y-1">
          {users.length === 0 && <p className="text-[10px] text-slate-500 px-1">Cargando usuarios…</p>}
          {users.map(u => {
            const n = devCount.get(u.id) || 0;
            return (
              <label key={u.id} className="flex items-center gap-2 px-1.5 py-1 cursor-pointer hover:bg-slate-800 rounded">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => onToggle(u.id)}
                  className="accent-emerald-500 w-3.5 h-3.5 shrink-0"
                />
                <span className="text-[11px] font-bold text-white truncate">{u.name}</span>
                {n > 0 && <span className="text-[9px] bg-emerald-600/20 text-emerald-400 px-1 rounded font-bold shrink-0" title={`${n} móvil(es) activado(s) por este usuario`}>📱×{n}</span>}
                {!u.isActive && <span className="text-[9px] text-slate-500 shrink-0">inactivo</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Selector de canal (¿POR DÓNDE le llega?) — solo en MÁS OPCIONES ──
function ChannelPicker({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) {
  const opts: Channel[] = ["push", "email", "both"];
  return (
    <div>
      <span className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1.5">¿Por dónde?</span>
      <div className="flex gap-1">
        {opts.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`flex-1 text-[10px] px-2 py-1.5 rounded font-bold transition ${value === c ? "bg-[#2E5D3A] text-white ring-1 ring-emerald-400" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}>
            {CHANNEL_SHORT[c]}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-slate-500 mt-1 leading-tight">
        📱 = a los móviles activados de cada usuario · ✉️ = al correo de cada usuario
      </p>
    </div>
  );
}

function AlertRulesPanel() {
  const [open, setOpen] = useState(true);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [emailOk, setEmailOk] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [days, setDays] = useState("1");
  const [showAdv, setShowAdv] = useState(false);
  const [recAll, setRecAll] = useState(true);
  const [recSel, setRecSel] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<Channel>("push");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Edición de una regla existente
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState("1");
  const [editRecAll, setEditRecAll] = useState(true);
  const [editRecSel, setEditRecSel] = useState<Set<string>>(new Set());
  const [editChannel, setEditChannel] = useState<Channel>("both");
  // Estado de las notificaciones en ESTE dispositivo
  const [notif, setNotif] = useState<"checking" | "unsupported" | "denied" | "off" | "subscribed">("checking");
  // Entorno del dispositivo (para dar la instrucción EXACTA en iPhone)
  const [env, setEnv] = useState<{ ios: boolean; standalone: boolean }>({ ios: false, standalone: false });

  const load = async () => {
    try {
      const res = await fetch("/api/company/alert-rules");
      if (res.ok) {
        const j = await res.json();
        setRules(j.rules || []);
        setUsers(j.users || []);
        setDevices(j.devices || []);
        setEmailOk(!!j.emailConfigured);
      }
    } catch { /* noop */ }
  };

  const checkNotif = async () => {
    try {
      if (typeof window === "undefined") return;
      const ua = navigator.userAgent || "";
      const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
        || (navigator as unknown as { standalone?: boolean }).standalone === true;
      setEnv({ ios, standalone });
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
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
    // Diagnóstico ANTES de intentar nada: explica el porqué EXACTO en iPhone
    if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) {
      if (env.ios && env.standalone) {
        setMsg("⚠️ Tu iPhone necesita iOS 16.4 o superior: Ajustes → General → Actualización de software. Después vuelve aquí.");
      } else if (env.ios) {
        setMsg("📱 Estás DENTRO de Safari y ahí NO se puede. Hazlo así: Compartir ⬆️ → «Añadir a pantalla de inicio» → abre MURAL desde el ICONO nuevo → CONFIGURACIÓN → 🔔 ACTIVAR AQUÍ");
      } else {
        setMsg("⚠️ Este navegador no soporta notificaciones. Usa Chrome (Android) o Chrome/Edge en PC.");
      }
      setNotif("unsupported");
      setBusy(false);
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotif("denied");
        setMsg("⛔ Permiso denegado. Vuelve a intentarlo o actívalo en los ajustes del navegador.");
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
      setMsg("✅ ¡LISTO! Este móvil ya recibe avisos.");
      await load();
    } catch (err) {
      const e = err as Error;
      setMsg(`⚠️ Fallo real: ${e?.name || "Error"} — ${e?.message || String(err)}. En iPhone: abre desde el icono de inicio (no Safari); si estaba bloqueado, borra el icono y vuelve a añadirlo.`);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/company/push/prueba", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? `📤 Prueba enviada a ${j.sent} dispositivo(s)` : (j.error || "Error al enviar"));
    } catch { setMsg("Error de conexión"); } finally { setBusy(false); }
  };

  const addRule = async () => {
    if (!keyword.trim()) { setMsg("Escribe la palabra a vigilar (la que pondrás en las notas)"); return; }
    if (!recAll && recSel.size === 0) { setMsg("Elige al menos un usuario (o pulsa TODOS)"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/company/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          daysBefore: parseInt(days, 10) || 1,
          recipients: recAll ? [] : [...recSel],
          channel,
        }),
      });
      if (res.ok) {
        setKeyword("");
        setDays("1");
        setRecAll(true);
        setRecSel(new Set());
        setChannel("push");
        await load();
        setMsg("✅ Aviso creado. Pon esa palabra en la nota de la tarjeta y llegará solo.");
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error || "Error al crear");
      }
    } catch { setMsg("Error de conexión"); } finally { setBusy(false); }
  };

  const startEdit = (r: AlertRule) => {
    const ids = (r.recipients || "").split(",").map(s => s.trim()).filter(Boolean);
    setEditingId(r.id);
    setEditDays(String(r.daysBefore));
    setEditRecAll(ids.length === 0);
    setEditRecSel(new Set(ids));
    setEditChannel((r.channel as Channel) || "both");
  };

  const saveEdit = async (r: AlertRule) => {
    if (!editRecAll && editRecSel.size === 0) { setMsg("Elige al menos un usuario (o pulsa TODOS)"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/company/alert-rules/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daysBefore: parseInt(editDays, 10) || r.daysBefore,
          recipients: editRecAll ? [] : [...editRecSel],
          channel: editChannel,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await load();
        setMsg("✅ Cambios guardados");
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error || "Error al guardar");
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
    if (!confirm(`¿Borrar el aviso «${r.keyword}»?`)) return;
    setRules(prev => prev.filter(x => x.id !== r.id));
    await fetch(`/api/company/alert-rules/${r.id}`, { method: "DELETE" }).catch(() => {});
  };

  const namesOfSel = (ids: string[]): string =>
    ids.map(id => {
      const u = users.find(x => x.id === id);
      return u ? u.name.split(" ").slice(0, 2).join(" ") : "usuario";
    }).join(", ");

  const namesOf = (r: AlertRule): string => {
    const ids = (r.recipients || "").split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return "TODOS";
    return namesOfSel(ids);
  };

  const unsupportedText = env.ios
    ? (env.standalone
      ? "📱 App abierta desde el icono ✓, pero este iPhone necesita iOS 16.4+ para notificaciones (Ajustes → General → Actualización de software)"
      : "📱 Estás DENTRO de Safari → ahí NO se puede activar. Añade la app a inicio (paso 2 ↓) y abre MURAL desde el ICONO nuevo")
    : "Este navegador no permite notificaciones (Android: Chrome · PC: Chrome o Edge)";

  const notifLabel = {
    checking: "Comprobando este dispositivo…",
    unsupported: unsupportedText,
    denied: env.ios && env.standalone
      ? "⛔ Notificaciones BLOQUEADAS: borra el icono de inicio, añádelo otra vez y reintenta (se resetea el permiso)"
      : "⛔ BLOQUEADO en este navegador: Ajustes → Notificaciones → permitir esta web",
    off: "⚠️ Este dispositivo AÚN NO recibe avisos",
    subscribed: "✅ Este dispositivo YA recibe avisos",
  }[notif];

  const createSummary = `${channelLabel(channel)} · para: ${recAll ? "TODOS" : namesOfSel([...recSel])}`;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
      {/* ── Cabecera ── */}
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="text-2xl">🔔</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-white text-sm">Avisos al móvil</span>
          <span className="block text-xs text-slate-400">① Activa tu móvil · ② Crea el aviso · ③ Llega solo, cada día a las 10:00</span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">

          {/* ════════ PASO 1 · ACTIVA TU MÓVIL ════════ */}
          <div className={`rounded-lg p-3 border space-y-2 ${notif === "subscribed" ? "border-emerald-600/40 bg-emerald-900/10" : "border-amber-500/40 bg-amber-500/5"}`}>
            <div className="text-xs font-black uppercase tracking-wide">
              <span className={notif === "subscribed" ? "text-emerald-400" : "text-amber-400"}>① Activa tu móvil</span>
              <span className="text-slate-500 font-bold"> — UNA sola vez, en cada móvil</span>
            </div>

            <p className={`text-xs font-bold ${notif === "subscribed" ? "text-[#6BBE7A]" : notif === "denied" || notif === "unsupported" ? "text-red-400" : "text-amber-400"}`}>
              {notifLabel}
            </p>

            {(notif === "off" || notif === "denied" || notif === "unsupported") && (
              <button onClick={enableNotif} disabled={busy}
                className="w-full bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-sm font-black px-4 py-3 rounded-lg transition">
                🔔 ACTIVAR AQUÍ
              </button>
            )}
            {notif === "unsupported" && env.ios && !env.standalone && (
              <p className="text-[10px] font-bold text-amber-400 leading-snug">
                El botón SOLO funciona desde el icono de inicio, no desde Safari. Si ya lo tienes en inicio: cierra esto y abre MURAL desde el icono 📲.
              </p>
            )}

            {/* Instrucciones SIEMPRE visibles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-slate-900/60 border border-slate-700 rounded p-2">
                <div className="text-[10px] font-black text-slate-200 mb-1">🤖 ANDROID (Chrome)</div>
                <ol className="text-[10px] text-slate-400 leading-snug list-decimal ml-3.5 space-y-0.5">
                  <li>Abre la app <b className="text-slate-200">en el móvil</b></li>
                  <li>Entra con tu usuario</li>
                  <li>CONFIGURACIÓN → <b className="text-[#6BBE7A]">🔔 ACTIVAR AQUÍ</b></li>
                  <li>Pulsa <b className="text-slate-200">Permitir</b></li>
                </ol>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded p-2">
                <div className="text-[10px] font-black text-slate-200 mb-1">🍎 IPHONE (Safari)</div>
                <ol className="text-[10px] text-slate-400 leading-snug list-decimal ml-3.5 space-y-0.5">
                  <li>Abre la app en <b className="text-slate-200">Safari</b></li>
                  <li>Compartir ⬆️ → <b className="text-slate-200">«Añadir a pantalla de inicio»</b> → Añadir</li>
                  <li>Cierra Safari y abre MURAL <b className="text-slate-200">desde el ICONO nuevo</b> 📲</li>
                  <li>Abajo toca <b className="text-slate-200">⚙️ CONFIGURACIÓN</b> → <b className="text-[#6BBE7A]">🔔 ACTIVAR AQUÍ</b> → Permitir</li>
                </ol>
                <p className="text-[9px] text-slate-500 leading-tight mt-1">
                  ¿No sale «Permitir»? Borra el icono, añádelo otra vez (paso 2) y reintenta.
                </p>
              </div>
            </div>

            {/* Móviles activados */}
            <div>
              <div className="text-[10px] font-black text-slate-300 uppercase mb-1">
                Móviles activados: {devices.length}
              </div>
              {devices.length === 0 ? (
                <p className="text-[10px] font-bold text-red-400 leading-snug">
                  ⚠️ Aún no hay NINGÚN móvil activado → hasta que no hagas el PASO ① en un móvil, no puede llegar nada.
                </p>
              ) : (
                <div className="bg-slate-900/60 border border-slate-700 rounded p-2 space-y-0.5">
                  {devices.map(d => (
                    <div key={d.id} className="text-[10px] text-slate-400 leading-snug">
                      📱 <span className="font-bold text-white">{d.userName}</span>
                      {" · "}{deviceType(d.userAgent)}
                      {" · "}{d.createdAt ? new Date(d.createdAt).toLocaleDateString("es-ES") : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={sendTest} disabled={busy || devices.length === 0}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-[10px] font-bold px-3 py-2 rounded-lg transition"
                title="Enviar una notificación de prueba a TODOS los móviles activados">
                📤 ENVIAR PRUEBA
              </button>
              <span className="text-[9px] text-slate-500 leading-tight">comprueba que llega de verdad al móvil</span>
            </div>

            {msg && <p className="text-[11px] text-amber-400 font-bold">{msg}</p>}
          </div>

          {/* ════════ PASO 2 · CREA UN AVISO ════════ */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="text-xs font-black text-blue-400 uppercase">② Crea un aviso</div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Pon una <b className="text-slate-200">palabra</b> (p. ej. CIRUGÍA) en la nota de una tarjeta: si faltan <b className="text-slate-200">X días</b> para su fecha, llega el aviso.
            </p>
            <div className="flex items-center gap-2">
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="PALABRA"
                className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 uppercase"
              />
              <input
                type="number" min={0} max={365} value={days}
                onChange={e => setDays(e.target.value)}
                className="w-14 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center shrink-0"
              />
              <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">días antes</span>
            </div>
            <button onClick={addRule} disabled={busy}
              className="w-full bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-sm font-black px-4 py-3 rounded-lg transition">
              ➕ CREAR AVISO
            </button>
            <p className="text-[9px] text-slate-500 text-center">Llegará por {createSummary}</p>

            <button type="button" onClick={() => setShowAdv(v => !v)}
              className="text-[10px] text-blue-400 font-black hover:text-blue-300">
              {showAdv ? "▲ Ocultar opciones" : "▼ Cambiar a quién y por dónde"}
            </button>
            {showAdv && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                <RecipientsPicker
                  users={users} devices={devices} all={recAll} selected={recSel}
                  onSetAll={v => { setRecAll(v); if (v) setRecSel(new Set()); }}
                  onToggle={id => setRecSel(prev => {
                    const n = new Set(prev);
                    if (n.has(id)) n.delete(id); else n.add(id);
                    return n;
                  })}
                />
                <ChannelPicker value={channel} onChange={setChannel} />
              </div>
            )}
          </div>

          {/* ════════ PASO 3 · TUS AVISOS ════════ */}
          <div className="space-y-1">
            <div className="text-xs font-black text-blue-400 uppercase px-1">③ Tus avisos ({rules.length})</div>
            {rules.length === 0 && (
              <p className="text-xs text-slate-500 py-2 text-center">Todavía no hay ninguno. Crea el primero en el PASO ② ↑</p>
            )}
            {rules.map(r => {
              const editing = editingId === r.id;
              return (
                <div key={r.id} className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${r.enabled ? "bg-[#6BBE7A]" : "bg-slate-600"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-white truncate">“{r.keyword}”</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {r.daysBefore === 0 ? "El mismo día" : `${r.daysBefore} día(s) antes`} · {channelLabel(r.channel)} · {namesOf(r)}{r.enabled ? "" : " · ⏸ pausado"}
                      </div>
                    </div>
                    <button
                      onClick={() => (editing ? setEditingId(null) : startEdit(r))}
                      className="shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition"
                      title="Cambiar días, a quién y por dónde">
                      {editing ? "▲" : "✏️"}
                    </button>
                    <button
                      onClick={() => toggleRule(r)}
                      className={`shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition ${r.enabled ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white"}`}
                      title={r.enabled ? "Pausar" : "Reactivar"}
                    >
                      {r.enabled ? "⏸" : "▶"}
                    </button>
                    <button
                      onClick={() => deleteRule(r)}
                      className="shrink-0 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold w-8 h-8 rounded-lg transition"
                      title="Borrar"
                    >
                      🗑
                    </button>
                  </div>

                  {editing && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Avisar</span>
                        <input
                          type="number" min={0} max={365} value={editDays}
                          onChange={e => setEditDays(e.target.value)}
                          className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center"
                        />
                        <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">días antes</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <RecipientsPicker
                          users={users} devices={devices} all={editRecAll} selected={editRecSel}
                          onSetAll={v => { setEditRecAll(v); if (v) setEditRecSel(new Set()); }}
                          onToggle={id => setEditRecSel(prev => {
                            const n = new Set(prev);
                            if (n.has(id)) n.delete(id); else n.add(id);
                            return n;
                          })}
                        />
                        <div className="space-y-2">
                          <ChannelPicker value={editChannel} onChange={setEditChannel} />
                          <button onClick={() => saveEdit(r)} disabled={busy}
                            className="w-full bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-xs font-black px-4 py-2.5 rounded-lg transition">
                            💾 GUARDAR
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Pie: qué mensaje llega ── */}
          <p className="text-[10px] text-slate-500 leading-snug px-1">
            ⏰ Cada día a las 10:00 (hora España) se revisan las notas. El aviso llega así: <b className="text-slate-400">«CIRUGÍA — faltan 3 días · 12/10 · Clínica Sur · Mañana»</b> + el texto de la nota. Cada tarjeta avisa UNA sola vez.
            {!emailOk && " ✉️ El correo aún no sale del servidor: de momento solo llega al 📱 móvil."}
          </p>
        </div>
      )}
    </div>
  );
}
