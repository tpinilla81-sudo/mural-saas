import webpush from "web-push";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// Web Push — claves VAPID guardadas en BD (se generan solas la
// primera vez) + envío de notificaciones a todos los dispositivos.
// ═══════════════════════════════════════════════════════════

export async function getVapid() {
  let row = await db.vapidKey.findUnique({ where: { id: "singleton" } });
  if (!row) {
    const keys = webpush.generateVAPIDKeys();
    row = await db.vapidKey.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", publicKey: keys.publicKey, privateKey: keys.privateKey },
    });
  }
  return row;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  source?: string; // plan | aviso | inline | prueba (para la bandeja del sobre 📩)
}

// Cada aviso enviado deja COPÍA en la bandeja interna del usuario
// (sobre 📩 de la barra): así los ve aunque el push no llegue o la
// campana esté desactivada en ese dispositivo.
async function createInbox(userIds: string[], payload: PushPayload): Promise<void> {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (ids.length === 0) return;
  try {
    await db.inboxMessage.createMany({
      data: ids.map((uid) => ({
        userId: uid,
        title: payload.title,
        body: payload.body,
        url: payload.url || "/",
        source: payload.source || "",
      })),
    });
  } catch { /* la bandeja nunca debe romper el envío */ }
}

/** Envía un push a TODOS los dispositivos suscritos Y ACTIVADOS. Devuelve cuántos recibieron. */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  const vapid = await getVapid();
  webpush.setVapidDetails("mailto:aviso@mural.app", vapid.publicKey, vapid.privateKey);
  const [subs, users] = await Promise.all([
    db.pushSub.findMany({ where: { enabled: true } }),
    db.user.findMany({ where: { isActive: true, role: { not: "SUPER_ADMIN" } }, select: { id: true } }),
  ]);
  await createInbox(users.map((u) => u.id), payload);
  return deliver(subs, payload);
}

/** Envía un push SOLO a los dispositivos ACTIVADOS de los usuarios indicados (User.id). */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return 0;
  const vapid = await getVapid();
  webpush.setVapidDetails("mailto:aviso@mural.app", vapid.publicKey, vapid.privateKey);
  const [subs] = await Promise.all([
    db.pushSub.findMany({ where: { userId: { in: ids }, enabled: true } }),
    createInbox(ids, payload),
  ]);
  return deliver(subs, payload);
}

async function deliver(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
): Promise<number> {
  let ok = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || "/", tag: payload.tag })
        );
        ok++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        // Suscripción caducada → la quitamos
        if (status === 404 || status === 410) {
          await db.pushSub.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
  return ok;
}
