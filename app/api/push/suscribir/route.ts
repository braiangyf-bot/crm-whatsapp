import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type CuerpoSuscripcionPush = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string | null;
  nombreDispositivo?: string | null;
};

type AutenticacionConUsuario = {
  usuario?: {
    id?: string;
  };
  user?: {
    id?: string;
  };
};

export async function POST(request: Request) {
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

    const body = (await request.json()) as CuerpoSuscripcionPush;

    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "La suscripción push está incompleta." },
        { status: 400 }
      );
    }

    const userAgent =
      body.userAgent?.trim() || request.headers.get("user-agent") || null;

    const nombreDispositivo = body.nombreDispositivo?.trim() || null;

    await prisma.suscripciones_push.upsert({
      where: {
        endpoint,
      },
      create: {
        usuario_id: usuarioId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        nombre_dispositivo: nombreDispositivo,
        activa: true,
        ultimo_uso: new Date(),
        cantidad_fallos: 0,
        ultimo_error: null,
      },
      update: {
        usuario_id: usuarioId,
        p256dh,
        auth,
        user_agent: userAgent,
        nombre_dispositivo: nombreDispositivo,
        activa: true,
        ultimo_uso: new Date(),
        cantidad_fallos: 0,
        ultimo_error: null,
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje: "Suscripción push guardada correctamente.",
    });
  } catch (error) {
    console.error("Error guardando suscripción push:", error);

    return NextResponse.json(
      { error: "Error al guardar la suscripción push." },
      { status: 500 }
    );
  }
}