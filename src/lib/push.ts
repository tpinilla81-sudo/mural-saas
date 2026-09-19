import webpush from "web-push";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// Web Push — claves VAPID guardadas en BD (se generan solas la
// primera vez) + envío de notificaciones a todos los dispositivos.
// ═══════════════════════════════════════════════════════════

export async function getVapid() {
  let row = await db.vapidKey.findUnique({ where: { id: "singleton" } });
  if (!row) {
    const keys = webpush.generateVapidKeys();
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
}

/** Envía un push a TODOS los dispositivos suscritos. Devuelve cuántos recibieron. */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  const vapid = await getVapid();
  webpush.setVapidDetails("mailto:aviso@mural.app", vapid.publicKey, vapid.privateKey);
  const subs = await db.pushSub.findMany();
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
