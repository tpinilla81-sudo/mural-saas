"use client";

// ═══════════════════════════════════════════════════════════
// 🔔 AVISO PICKER — sección reutilizable "¿Quieres crear una
// notificación? → ¿A quién? → ¿Con cuántos días de antelación?"
// Usada en: alta de turno (Mensual), nota de turno, nota de aviso
// y aviso por voz. El aviso se guarda COMO TOKEN en la nota
// (@N = todos · @N:Nombre,Nombre = elegidos) y el cron diario
// (src/app/api/cron/alerts) lo convierte en push + entrada en
// la bandeja 📩 el día que toque.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

// ── Token inline en la nota: @N (todos) o @N:Nombre,Nombre ──
export const AVISO_TOKEN_RE = /@(\d{1,2})(?::([^\n@]*))?/;

/** Quita TODOS los tokens @N[:nombres] de un texto. */
export function stripAvisoToken(t: string): string {
  return (t || "").replace(/@(\d{1,2})(?::[^\n@]*)?/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Lee el token de un texto: { on, days, all, names, raw } */
export function parseAvisoToken(t: string): { on: boolean; days: number; all: boolean; names: string[]; raw: string } {
  const m = (t || "").match(AVISO_TOKEN_RE);
  if (!m) return { on: false, days: 7, all: true, names: [], raw: "" };
  const names = (m[2] || "").split(",").map(s => s.trim()).filter(Boolean);
  const days = Math.max(0, Math.min(60, parseInt(m[1], 10) || 0));
  return { on: true, days, all: names.length === 0, names, raw: m[0] };
}

/** Nombres del token → ids de usuarios (match flexible, igual que el cron). */
export function usersFromNames(names: string[], users: { id: string; name: string }[]): Set<string> {
  const sel = new Set<string>();
  for (const tk of names) {
    const k = tk.toLowerCase();
    for (const u of users) {
      const un = (u.name || "").toLowerCase();
      if (un && (un.includes(k) || k.includes(un))) sel.add(u.id);
    }
  }
  return sel;
}

/** Nota final: con aviso → token añadido; sin aviso → se quita el token ORIGINAL
 *  (rawLoaded) pero se respetan los que el usuario haya escrito a mano después. */
export function buildAvisoNote(
  base: string,
  on: boolean,
  days: number,
  names: string[] | null,
  rawLoaded = ""
): string {
  if (!on) {
    if (!rawLoaded) return (base || "").trim();
    // quita SOLO el token que venía guardado (los demás se quedan)
    return base.replace(rawLoaded, " ").replace(/\s{2,}/g, " ").trim();
  }
  const clean = stripAvisoToken(base);
  const d = clampAvisoDays(days);
  const suffix = names && names.length > 0 ? `:${names.join(",")}` : "";
  return `${clean} @${d}${suffix}`.trim();
}

export function clampAvisoDays(d: number): number {
  const n = parseInt(String(d), 10);
  return isNaN(n) ? 7 : Math.max(0, Math.min(60, n));
}

/** Usuarios de la empresa (para ¿A quién?). Devuelve [] si no hay permiso. */
export function useAppUsers(): { id: string; name: string }[] {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/company/alert-rules")
      .then(r => (r.ok ? r.json() : {}))
      .then((j: { users?: { id: string; name: string; isActive?: boolean }[] }) => {
        if (!alive) return;
        const list = (j.users || []) as { id: string; name: string; isActive?: boolean }[];
        setUsers(list.filter(u => u.isActive !== false && u.name).map(u => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return users;
}

interface AvisoPickerProps {
  users: { id: string; name: string }[];
  on: boolean;
  days: number;
  all: boolean;
  sel: Set<string>;
  setOn: (v: boolean) => void;
  setDays: (v: number) => void;
  setAll: (v: boolean) => void;
  setSel: (s: Set<string>) => void;
  tone?: "light" | "dark";
}

export default function AvisoPicker({
  users, on, days, all, sel, setOn, setDays, setAll, setSel, tone = "light",
}: AvisoPickerProps) {
  const dark = tone === "dark";
  const box = dark
    ? "border-2 border-amber-500/70 bg-amber-500/10 rounded-lg p-2.5 space-y-2"
    : "border-2 border-amber-400 bg-amber-50 rounded-lg p-2.5 space-y-2";
  const labelText = dark ? "text-[11px] font-black text-amber-300 uppercase" : "text-[11px] font-black text-gray-900 uppercase";
  const fieldText = dark ? "text-[11px] font-extrabold text-slate-300 uppercase" : "text-[11px] font-extrabold text-gray-700 uppercase";
  const inputCls = dark
    ? "w-16 px-2 py-1 bg-slate-900 border-2 border-slate-600 focus:border-amber-500 rounded-lg text-sm text-white font-bold text-center"
    : "w-16 px-2 py-1 bg-white border-2 border-gray-300 focus:border-amber-500 rounded-lg text-sm text-gray-900 font-bold text-center";
  const btn = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-black border transition ${
      active
        ? "bg-gray-900 text-white border-gray-900"
        : dark
          ? "bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
    }`;
  const whoBox = dark ? "bg-slate-900 border-slate-600" : "bg-white border-gray-300";
  const whoItem = dark ? "text-slate-200" : "text-gray-800";

  return (
    <div className={box}>
      {/* LA PREGUNTA: ¿crear notificación? */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={on}
          onChange={e => setOn(e.target.checked)}
          className="w-4 h-4 accent-amber-600 shrink-0"
        />
        <span className={labelText}>🔔 ¿Crear una notificación?</span>
      </label>

      {/* SI ES SÍ → las preguntas consecuentes */}
      {on && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={fieldText}>¿Con cuántos días de antelación?</span>
            <input
              type="number" min={0} max={60} value={days}
              onChange={e => setDays(parseInt(e.target.value, 10) || 0)}
              className={inputCls}
            />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">día(s) antes (0–60)</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={fieldText}>¿A quién?</span>
            <button type="button" onClick={() => setAll(true)} className={btn(all)}>TODOS</button>
            <button type="button" onClick={() => setAll(false)} className={btn(!all)}>ELEGIR</button>
          </div>
          {!all && (
            <div className={`max-h-28 overflow-y-auto border rounded p-1.5 space-y-0.5 ${whoBox}`}>
              {users.length === 0 && (
                <p className={`text-[10px] font-bold ${dark ? "text-slate-400" : "text-gray-500"}`}>
                  Cargando usuarios… (si no aparece, se avisará a TODOS)
                </p>
              )}
              {users.map(u => (
                <label key={u.id} className={`flex items-center gap-2 text-xs cursor-pointer ${whoItem}`}>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-amber-600 shrink-0"
                    checked={sel.has(u.id)}
                    onChange={() => {
                      const n = new Set(sel);
                      if (n.has(u.id)) n.delete(u.id); else n.add(u.id);
                      setSel(n);
                    }}
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
          <p className={`text-[10px] font-bold leading-snug ${
            !all && sel.size === 0 ? (dark ? "text-red-400" : "text-red-600") : dark ? "text-slate-400" : "text-gray-500"
          }`}>
            {!all && sel.size === 0
              ? "Sin nadie elegido → lo recibirá TODO el equipo."
              : all
                ? "Lo recibirá TODO el equipo por 📱 push (+ copia en el sobre 📩)."
                : `Lo recibirán ${sel.size} elegido(s) por 📱 push (+ copia en el sobre 📩).`}
          </p>
        </>
      )}
      {/* SI ES NO → no se pregunta nada más */}
    </div>
  );
}
