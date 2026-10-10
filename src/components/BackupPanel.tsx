"use client";

import { useState, useEffect, useRef } from "react";

interface Backup {
  id: string;
  label: string;
  filename: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  } catch { return iso; }
}

export default function BackupPanel() {
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err" | "">("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/company/backup/list");
      if (r.ok) setBackups(await r.json());
    } catch {}
  };

  useEffect(() => {
    if (open && backups.length === 0) load();
  }, [open]);

  const notify = (type: "ok" | "err", text: string) => {
    setMsgType(type); setMsg(text);
    setTimeout(() => { setMsg(""); setMsgType(""); }, 8000);
  };

  const createBackup = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/company/backup/create", { method: "POST" });
      const body = await r.json();
      if (!r.ok) { notify("err", "❌ " + (body.error || "No se pudo crear el backup")); return; }
      notify("ok", `✅ Backup creado: ${body.counts.plans} turnos, ${body.counts.avisos} avisos, ${body.counts.sedes} sedes, ${body.counts.professionals} profesionales (${formatSize(body.size)})`);
      await load();
    } catch (e: any) { notify("err", "❌ Error: " + (e?.message || String(e))); }
    finally { setBusy(false); }
  };

  const downloadBackup = (b: Backup) => {
    // Descarga directa: el navegador abre el URL y guarda el archivo
    window.location.href = `/api/company/backup/download/${b.id}`;
  };

  const restoreBackup = async (b: Backup, mode: "merge" | "replace") => {
    const confirmText = mode === "replace"
      ? `⚠️ Esto BORRA todos los datos actuales y los reemplaza por los del backup "${b.label}". ¿Estás seguro?`
      : `¿Añadir los datos del backup "${b.label}" a los actuales? (merge — no borra nada, solo añade lo que falta)`;
    if (!confirm(confirmText)) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/company/backup/restore/${b.id}?mode=${mode}`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) { notify("err", "❌ " + (body.error || "No se pudo restaurar")); return; }
      notify("ok", `✅ Restaurado (${mode}): ${body.counts.plans} turnos, ${body.counts.avisos} avisos, ${body.counts.sedes} sedes, ${body.counts.professionals} profesionales. Recarga la página para ver los cambios.`);
    } catch (e: any) { notify("err", "❌ Error: " + (e?.message || String(e))); }
    finally { setBusy(false); }
  };

  const deleteBackup = async (b: Backup) => {
    if (!confirm(`¿Borrar el backup "${b.label}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/company/backup/download/${b.id}`, { method: "DELETE" });
      if (!r.ok) { const body = await r.json(); notify("err", "❌ " + (body.error || "No se pudo borrar")); return; }
      await load();
    } catch (e: any) { notify("err", "❌ " + (e?.message || String(e))); }
    finally { setBusy(false); }
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirmText = importMode === "replace"
      ? `⚠️ Esto BORRA todos los datos actuales y los reemplaza por los del archivo "${file.name}". ¿Estás seguro?`
      : `¿Añadir los datos del archivo "${file.name}" a los actuales? (merge)`;
    if (!confirm(confirmText)) { if (fileRef.current) fileRef.current.value = ""; return; }
    setBusy(true); setMsg("");
    try {
      const text = await file.text();
      const r = await fetch(`/api/company/backup/import?mode=${importMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const body = await r.json();
      if (!r.ok) { notify("err", "❌ " + (body.error || "No se pudo importar")); return; }
      notify("ok", `✅ Importado (${importMode}): ${body.counts.plans} turnos, ${body.counts.avisos} avisos, ${body.counts.sedes} sedes. Recarga la página para ver los cambios.`);
    } catch (e: any) { notify("err", "❌ Error: " + (e?.message || String(e))); }
    finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="text-2xl">💾</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-white text-sm">Copia de seguridad</span>
          <span className="block text-xs text-slate-400">Crea hasta 5 backups · Descárgalos al PC · Restáuralos si hace falta</span>
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

          {/* Acciones principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={createBackup} disabled={busy}
              className="bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white text-sm font-black px-4 py-3 rounded-lg transition flex items-center justify-center gap-2">
              💾 CREAR BACKUP
            </button>
            <label className={`cursor-pointer ${busy ? "opacity-40 pointer-events-none" : ""} bg-sky-700 hover:bg-sky-600 text-white text-sm font-black px-4 py-3 rounded-lg transition flex items-center justify-center gap-2`}>
              📂 SUBIR Y RESTAURAR ARCHIVO
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImportFile} className="hidden" />
            </label>
          </div>

          {/* Modo de restauración */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">Modo al restaurar:</span>
            <button onClick={() => setImportMode("merge")} className={`px-2 py-1 rounded font-bold ${importMode === "merge" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`}>MERGE (añadir)</button>
            <button onClick={() => setImportMode("replace")} className={`px-2 py-1 rounded font-bold ${importMode === "replace" ? "bg-red-600 text-white" : "bg-slate-700 text-slate-300"}`}>REPLACE (reemplazar)</button>
            <span className="text-slate-500">
              {importMode === "merge" ? "Añade lo que falte, no borra nada" : "Borra TODO y lo reemplaza por el backup"}
            </span>
          </div>

          {/* Listado de backups (máx 5) */}
          <div>
            <div className="text-xs font-black text-slate-300 uppercase mb-1">
              Backups guardados ({backups.length}/5) — el más nuevo arriba
            </div>
            {backups.length === 0 && (
              <p className="text-xs text-slate-500 italic py-2 text-center">Aún no hay ningún backup. Pulsa "CREAR BACKUP" para crear el primero.</p>
            )}
            <div className="space-y-1.5">
              {backups.map((b, i) => (
                <div key={b.id} className={`bg-slate-900/60 border ${i === 0 ? "border-emerald-700/40" : "border-slate-700"} rounded-lg px-3 py-2`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{i === 0 ? "🟢" : "⚪"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{b.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{formatDate(b.createdAt)} · {formatSize(b.size)} · {b.filename}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button onClick={() => downloadBackup(b)} disabled={busy}
                      className="text-[10px] font-black bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white px-2.5 py-1.5 rounded transition">⬇ DESCARGAR</button>
                    <button onClick={() => restoreBackup(b, "merge")} disabled={busy}
                      className="text-[10px] font-black bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-white px-2.5 py-1.5 rounded transition" title="Añadir a los datos actuales sin borrar">↩ RESTAURAR (MERGE)</button>
                    <button onClick={() => restoreBackup(b, "replace")} disabled={busy}
                      className="text-[10px] font-black bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white px-2.5 py-1.5 rounded transition" title="Borrar todo y reemplazar por este backup">⚠ RESTAURAR (REEMPLAZAR)</button>
                    <button onClick={() => deleteBackup(b)} disabled={busy}
                      className="text-[10px] font-bold bg-red-600/20 hover:bg-red-600 disabled:opacity-40 text-red-400 hover:text-white px-2.5 py-1.5 rounded transition">🗑</button>
                  </div>
                </div>
              ))}
            </div>
            {backups.length >= 5 && (
              <p className="text-[10px] text-amber-400 font-bold mt-1">⚠️ Has llegado al máximo de 5. El próximo backup borrará el más antiguo.</p>
            )}
          </div>

          <p className="text-[10px] text-slate-500 leading-snug px-1">
            Los backups guardan TODOS los turnos, avisos, sedes, profesionales y festivos de la empresa. Se guardan en el servidor (máximo 5, el más antiguo se sobreescribe). Puedes descargar cada backup al PC como archivo .json y volver a subirlo si hace falta. <b className="text-slate-400">REEMPLAZAR borra los datos actuales</b> — úsalo con cuidado.
          </p>
        </div>
      )}
    </div>
  );
}
