import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";
import { enviarNotificacionPush } from "@/lib/push/enviarNotificacion";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AutenticacionConUsuario = {
  usuario?: {
    id?: string;
  };
  user?: {
    id?: string;
  };
};

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

export async function POST() {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const datosAuth = autenticacion as AutenticacionConUsuario;
    const usuarioId = datosAuth.usuario?.id ?? datosAuth.user?.id;

    if (!usuarioId) {
      return NextResponse.json(
        { error: "No se pudo identificar el usuario autenticado." },
        { status: 401 }
      );
    }

    const suscripciones = await prisma.suscripciones_push.findMany({
      where: {
        usuario_id: usuarioId,
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
      return NextResponse.json({
        ok: true,
        enviadas: 0,
        fallidas: 0,
        mensaje: "No hay suscripciones push activas para este usuario.",
      });
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
            title: "CRM WhatsApp",
            body: "Notificación de prueba enviada desde el servidor.",
            url: "/bandeja",
            tag: "prueba-push",
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

        await prisma.suscripciones_push.update({
          where: {
            id: suscripcion.id,
          },
          data: {
            ultimo_uso: new Date(),
            cantidad_fallos: suscripcion.cantidad_fallos + 1,
            ultimo_error: mensajeError,
            activa:
              statusCode === 404 || statusCode === 410
                ? false
                : suscripcion.cantidad_fallos + 1 < 5,
          },
        });

        console.error("Error enviando push de prueba:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      enviadas,
      fallidas,
      mensaje: "Prueba push finalizada.",
    });
  } catch (error) {
    console.error("Error en prueba push:", error);

    return NextResponse.json(
      { error: "Error al ejecutar la prueba push." },
      { status: 500 }
    );
  }
}