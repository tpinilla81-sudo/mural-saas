"use client";

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — solo contiene 🔔 AVISOS PROGRAMADOS.
// (Los accesos y permisos se gestionan en MI EMPRESA → Accesos · Permisos.)
//
// Cada aviso programado permite elegir:
//   · ¿A QUIÉN le llega?  TODOS o unos usuarios concretos (están en la BD)
//   · ¿POR DÓNDE le llega?  📱 móvil (push) · ✉️ correo · 📱+✉️ ambos
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

// ───────────────────────────────────────────────────────────
// AVISOS PROGRAMADOS — cuando en las NOTAS de una tarjeta/aviso
// aparece una palabra y faltan X días → notificación.
// ───────────────────────────────────────────────────────────

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

const CHANNEL_LABEL: Record<Channel, string> = {
  push: "📱 Móvil",
  email: "✉️ Correo",
  both: "📱+✉️ Ambos",
};

function channelLabel(c: string): string {
  return CHANNEL_LABEL[(c as Channel)] || "📱+✉️ Ambos";
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

// ── Selector de destinatarios (¿A QUIÉN le llega?) ──
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
        <span className="text-[11px] font-extrabold text-slate-300 uppercase">¿A quién le llega?</span>
        <span className="text-[10px] text-emerald-400 font-bold">
          {all ? "TODOS LOS USUARIOS" : `${selected.size} elegido(s)`}
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
                <span className={`text-[9px] truncate ${u.isActive ? "text-emerald-400" : "text-slate-500"}`}>
                  {u.email}{!u.isActive && " · inactivo"}
                </span>
              </label>
            );
          })}
        </div>
      )}
      <p className="text-[9px] text-slate-500 mt-1 leading-tight">
        La notificación 📱 llega a los móviles que cada usuario activó con 🔔 ACTIVAR AQUÍ (los que tienen 📱 ya tienen móvil metido); el ✉️ correo llega a la dirección de cada usuario.
      </p>
    </div>
  );
}

// ── Selector de canal (¿POR DÓNDE le llega?) ──
function ChannelPicker({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) {
  const opts: Channel[] = ["push", "email", "both"];
  return (
    <div>
      <span className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1.5">¿Por dónde le llega?</span>
      <div className="flex gap-1">
        {opts.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`flex-1 text-[10px] px-2 py-1.5 rounded font-bold transition ${value === c ? "bg-[#2E5D3A] text-white ring-1 ring-emerald-400" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}>
            {CHANNEL_LABEL[c]}
          </button>
        ))}
      </div>
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
  const [recAll, setRecAll] = useState(true);
  const [recSel, setRecSel] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<Channel>("both");
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
      setMsg("✅ MÓVIL REGISTRADO — este dispositivo queda a nombre de tu usuario y aparecerá en la lista de móviles");
      await load();
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
        setChannel("both");
        await load();
        setMsg("✅ Aviso programado creado");
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
    if (!confirm(`¿Borrar el aviso programado «${r.keyword}»?`)) return;
    setRules(prev => prev.filter(x => x.id !== r.id));
    await fetch(`/api/company/alert-rules/${r.id}`, { method: "DELETE" }).catch(() => {});
  };

  const namesOf = (r: AlertRule): string => {
    const ids = (r.recipients || "").split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return "TODOS";
    return ids.map(id => {
      const u = users.find(x => x.id === id);
      return u ? u.name.split(" ").slice(0, 2).join(" ") : "usuario";
    }).join(", ");
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
          <span className="block font-bold text-white text-sm">Avisos programados (móvil y correo)</span>
          <span className="block text-xs text-slate-400">Cuando en las NOTAS de una tarjeta o aviso salga una palabra, avisamos X días antes. Eliges a quién y por dónde (móvil / correo / ambos).</span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* ── 0) Cómo funciona ── */}
          <div className="bg-slate-900/60 border border-blue-600/30 rounded-lg p-3 space-y-1.5">
            <div className="text-[11px] font-extrabold text-blue-400 uppercase">¿Cómo funciona? ¿A quién llega, por dónde y qué mensaje?</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">👤 ¿A quién?</span> En cada aviso eliges los usuarios que lo reciben (o TODOS). Están todos los de MI EMPRESA.
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">📱 ¿Cómo se METE un móvil?</span> No se puede meter desde aquí: hay que abrir la app EN ese móvil, entrar con su usuario y pulsar
              <span className="font-bold text-[#6BBE7A]"> 🔔 ACTIVAR AQUÍ</span>. Ese móvil queda registrado a nombre de ese usuario y aparece en la lista de móviles de abajo. Sin ese paso, al móvil no puede llegar nada.
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">📱 Móvil:</span> llega en los móviles/PC donde CADA usuario pulsó
              <span className="font-bold text-[#6BBE7A]"> 🔔 ACTIVAR AQUÍ</span> (cada dispositivo queda vinculado a su usuario).
              <span className="font-bold text-white"> ✉️ Correo:</span> llega a la dirección de correo de cada usuario elegido.
              {emailOk
                ? <span className="text-emerald-400 font-bold"> El envío de correo está ACTIVADO en el servidor ✓</span>
                : <span className="text-amber-400 font-bold"> ⚠️ El envío de correo NO está configurado aún en el servidor (Resend): los correos quedan en cola hasta activarlo.</span>}
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="font-bold text-white">📝 ¿Qué mensaje?</span> Ejemplo: <span className="text-amber-400 font-bold">«CIRUGÍA — MAÑANA»</span> con la fecha, la sede, el turno y el texto de la nota. Cada tarjeta se avisa UNA sola vez.
              <span className="font-bold text-white"> ⏰ ¿Cuándo?</span> Cada día a las 10:00 (hora España).
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

            {/* ── Móviles registrados ── */}
            <div className="pt-1">
              <div className="text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                📱 Móviles registrados ({devices.length})
              </div>
              {devices.length === 0 ? (
                <div className="bg-red-600/10 border border-red-600/40 rounded-lg p-2.5">
                  <p className="text-[11px] font-bold text-red-400 leading-snug">
                    ⚠️ NO HAY NINGÚN MÓVIL REGISTRADO: de momento las notificaciones al móvil NO pueden llegar a nadie (solo el ✉️ correo).
                  </p>
                  <p className="text-[10px] text-slate-400 leading-snug mt-1">
                    Para METER un móvil: abre la app en ese móvil con su usuario → CONFIGURACIÓN → pulsa 🔔 ACTIVAR AQUÍ. En iPhone hay que añadir antes la app a la pantalla de inicio.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-900/60 border border-slate-700 rounded p-2 space-y-1">
                  {devices.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-2 px-1 py-0.5">
                      <span className="text-[10px] text-slate-500 w-4 shrink-0">{i + 1}.</span>
                      <span className="text-[11px] font-bold text-white truncate">{d.userName}</span>
                      <span className="text-[9px] text-slate-400 truncate">{deviceType(d.userAgent)}</span>
                      <span className="text-[9px] text-slate-500 ml-auto shrink-0">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString("es-ES") : ""}
                      </span>
                    </div>
                  ))}
                  <p className="text-[9px] text-slate-500 leading-tight px-1 pt-0.5">
                    Los avisos 📱 llegan a estos móviles según el usuario elegido en cada aviso. Para añadir otro móvil: repite 🔔 ACTIVAR AQUÍ en ese dispositivo.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── 2) Crear aviso programado ── */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-3">
            <div className="text-[11px] font-extrabold text-blue-400 uppercase">2 · Crear aviso programado</div>
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RecipientsPicker
                users={users} devices={devices} all={recAll} selected={recSel}
                onSetAll={v => { setRecAll(v); if (v) setRecSel(new Set()); }}
                onToggle={id => setRecSel(prev => {
                  const n = new Set(prev);
                  if (n.has(id)) n.delete(id); else n.add(id);
                  return n;
                })}
              />
              <div className="space-y-2">
                <ChannelPicker value={channel} onChange={setChannel} />
                <button onClick={addRule} disabled={busy}
                  className="w-full bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-xs font-black px-4 py-2.5 rounded-lg transition">
                  ➕ AÑADIR AVISO
                </button>
              </div>
            </div>
          </div>

          {/* ── 3) Lista de avisos programados ── */}
          <div className="space-y-1">
            {rules.length === 0 && (
              <p className="text-xs text-slate-500 py-3 text-center">No hay avisos programados todavía.</p>
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
                        {r.daysBefore === 0 ? "El mismo día" : `${r.daysBefore} día(s) antes`} · {channelLabel(r.channel)} · para: {namesOf(r)} · {r.enabled ? "activo" : "pausado"}
                      </div>
                    </div>
                    <button
                      onClick={() => (editing ? setEditingId(null) : startEdit(r))}
                      className="shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition"
                      title="Cambiar a quién le llega y por dónde">
                      {editing ? "▲ CERRAR" : "✏️ CAMBIAR"}
                    </button>
                    <button
                      onClick={() => toggleRule(r)}
                      className={`shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition ${r.enabled ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white"}`}
                      title={r.enabled ? "Pausar este aviso" : "Reactivar este aviso"}
                    >
                      {r.enabled ? "⏸" : "▶"}
                    </button>
                    <button
                      onClick={() => deleteRule(r)}
                      className="shrink-0 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold w-8 h-8 rounded-lg transition"
                      title="Borrar este aviso programado"
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
                            💾 GUARDAR CAMBIOS
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
