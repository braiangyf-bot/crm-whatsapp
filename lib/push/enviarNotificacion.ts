import webpush from "web-push";

type DatosNotificacionPush = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let vapidConfigurado = false;

function configurarVapid() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    throw new Error("Faltan variables VAPID para enviar notificaciones push.");
  }

  if (!vapidConfigurado) {
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    vapidConfigurado = true;
  }
}

export async function enviarNotificacionPush(
  suscripcion: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  datos: DatosNotificacionPush
) {
  configurarVapid();

  const payload = JSON.stringify({
    title: datos.title,
    body: datos.body,
    url: datos.url ?? "/",
    tag: datos.tag ?? "crm-whatsapp",
  });

  return webpush.sendNotification(
    {
      endpoint: suscripcion.endpoint,
      keys: {
        p256dh: suscripcion.p256dh,
        auth: suscripcion.auth,
      },
    },
    payload
  );
}