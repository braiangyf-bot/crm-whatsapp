import { prisma } from "@/lib/prisma";
import { enviarNotificacionPush } from "@/lib/push/enviarNotificacion";

type DatosNuevoMensajeWhatsApp = {
  conversacionId: string;
  nombreCliente?: string | null;
  telefonoCliente: string;
  contenido?: string | null;
  tipo?: string | null;
};

function recortarTexto(texto: string, maximo = 120) {
  if (texto.length <= maximo) {
    return texto;
  }

  return `${texto.slice(0, maximo - 3)}...`;
}

function obtenerMensajeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error desconocido";
}

function obtenerStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error
  ) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;

    if (typeof statusCode === "number") {
      return statusCode;
    }
  }

  return null;
}

function construirCuerpoNotificacion(datos: DatosNuevoMensajeWhatsApp) {
  const nombre =
    datos.nombreCliente?.trim() || datos.telefonoCliente.trim();

  const contenido = datos.contenido?.trim();

  if (contenido) {
    return recortarTexto(`${nombre}: ${contenido}`);
  }

  const tipo = datos.tipo?.trim() || "mensaje";

  return recortarTexto(`${nombre} envió un ${tipo}.`);
}

export async function notificarNuevoMensajeWhatsApp(
  datos: DatosNuevoMensajeWhatsApp
) {
  try {
    const suscripciones = await prisma.suscripciones_push.findMany({
      where: {
        activa: true,
      },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        cantidad_fallos: true,
      },
    });

    if (suscripciones.length === 0) {
      return {
        ok: true,
        intentadas: 0,
        enviadas: 0,
        fallidas: 0,
      };
    }

    let enviadas = 0;
    let fallidas = 0;

    for (const suscripcion of suscripciones) {
      try {
        await enviarNotificacionPush(
          {
            endpoint: suscripcion.endpoint,
            p256dh: suscripcion.p256dh,
            auth: suscripcion.auth,
          },
          {
            title: "Nuevo mensaje de WhatsApp",
            body: construirCuerpoNotificacion(datos),
            url: `/bandeja/${datos.conversacionId}`,
            tag: `whatsapp-${datos.conversacionId}`,
          }
        );

        enviadas += 1;

        await prisma.suscripciones_push.update({
          where: {
            id: suscripcion.id,
          },
          data: {
            ultimo_uso: new Date(),
            cantidad_fallos: 0,
            ultimo_error: null,
          },
        });
      } catch (error) {
        fallidas += 1;

        const mensajeError = obtenerMensajeError(error);
        const statusCode = obtenerStatusCode(error);
        const cantidadFallos = suscripcion.cantidad_fallos + 1;

        await prisma.suscripciones_push.update({
          where: {
            id: suscripcion.id,
          },
          data: {
            ultimo_uso: new Date(),
            cantidad_fallos: cantidadFallos,
            ultimo_error: mensajeError,
            activa:
              statusCode === 404 || statusCode === 410
                ? false
                : cantidadFallos < 5,
          },
        });

        console.error("Error enviando push de nuevo mensaje:", error);
      }
    }

    return {
      ok: true,
      intentadas: suscripciones.length,
      enviadas,
      fallidas,
    };
  } catch (error) {
    console.error("Error preparando push de nuevo mensaje:", error);

    return {
      ok: false,
      intentadas: 0,
      enviadas: 0,
      fallidas: 0,
      error: obtenerMensajeError(error),
    };
  }
}