// ═══════════════════════════════════════════════════════════════
// MICRÓFONO — activación explícita del permiso (getUserMedia).
//
// Problema en Android Chrome: SpeechRecognition.start() falla con
// "not-allowed" si el permiso del micrófono no está concedido y, en
// muchas versiones, NI SIQUIERA muestra el prompt de permisos (sobre
// todo cuando el start() ocurre fuera del gesto directo del usuario,
// p.ej. después del TTS como en el Modo Coche).
//
// Solución fiable: llamar a getUserMedia({ audio: true }) DENTRO del
// gesto del usuario (al pulsar el botón de voz). Eso dispara el
// prompt, guarda el permiso y "calienta" el micro. Las pistas se
// sueltan enseguida para que el reconocimiento tome el micro después.
// ═══════════════════════════════════════════════════════════════

export type MicWarm =
  | { ok: true }
  | {
      ok: false;
      code: "denied" | "insecure" | "unsupported" | "nodevice" | "busy" | "error";
      hint: string;
    };

const HINTS: Record<string, string> = {
  denied:
    "Micrófono bloqueado. Toca el candado 🔒 de la barra de dirección → Permisos → Micrófono → Permitir, y vuelve a pulsar.",
  insecure:
    "El micrófono necesita conexión segura (HTTPS). Abre la web con https://",
  unsupported:
    "Este navegador no permite usar el micrófono. Prueba con Chrome.",
  nodevice:
    "No se detecta micrófono en este dispositivo.",
  busy:
    "El micrófono está ocupado por otra app. Ciérrala y vuelve a intentarlo.",
  error:
    "No se pudo activar el micrófono. Vuelve a pulsar el botón de voz.",
};

let inflight: Promise<MicWarm> | null = null;

async function doWarmUp(): Promise<MicWarm> {
  if (typeof window === "undefined")
    return { ok: false, code: "unsupported", hint: HINTS.unsupported };
  if (window.isSecureContext === false)
    return { ok: false, code: "insecure", hint: HINTS.insecure };
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia)
    return { ok: false, code: "unsupported", hint: HINTS.unsupported };
  try {
    // Vía rápida: permiso ya concedido → no tocar el micro (evita el
    // aviso naranja de "micro en uso" en cada pregunta).
    if (navigator.permissions?.query) {
      try {
        const st = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        if (st.state === "granted") return { ok: true };
      } catch {
        /* el navegador no soporta query de "microphone" → seguir */
      }
    }
    const stream = await md.getUserMedia({ audio: true });
    for (const t of stream.getTracks()) t.stop();
    return { ok: true };
  } catch (e) {
    const name = (e as DOMException)?.name || "";
    if (
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      name === "SecurityError"
    )
      return { ok: false, code: "denied", hint: HINTS.denied };
    if (
      name === "NotFoundError" ||
      name === "DevicesNotFoundError" ||
      name === "OverconstrainedError"
    )
      return { ok: false, code: "nodevice", hint: HINTS.nodevice };
    if (name === "NotReadableError" || name === "TrackStartError")
      return { ok: false, code: "busy", hint: HINTS.busy };
    return { ok: false, code: "error", hint: HINTS.error };
  }
}

// Pide/verifica el permiso del micro. Si ya hay una petición en curso
// devuelve la MISMA promesa (no duplica prompts de permisos).
export function warmUpMic(): Promise<MicWarm> {
  if (!inflight) {
    inflight = doWarmUp().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

// Espera el warm-up como mucho `ms` (por si el prompt queda abierto y
// nadie lo responde): pasado el plazo se continúa igualmente y será
// el propio SpeechRecognition quien reporte el error si de verdad no
// hay micro. Así el prompt del usuario nunca bloquea la app.
export function warmUpMicWithTimeout(ms = 3000): Promise<MicWarm | null> {
  return Promise.race([
    warmUpMic(),
    new Promise<null>(res => setTimeout(() => res(null), ms)),
  ]);
}
