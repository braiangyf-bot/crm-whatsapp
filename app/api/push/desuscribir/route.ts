import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type CuerpoDesuscripcionPush = {
  endpoint?: string;
};

export async function POST(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const body = (await request.json()) as CuerpoDesuscripcionPush;
    const endpoint = body.endpoint?.trim();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Falta el endpoint de la suscripción push." },
        { status: 400 }
      );
    }

    await prisma.suscripciones_push.updateMany({
      where: {
        endpoint,
      },
      data: {
        activa: false,
        ultimo_uso: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje: "Suscripción push desactivada correctamente.",
    });
  } catch (error) {
    console.error("Error desactivando suscripción push:", error);

    return NextResponse.json(
      { error: "Error al desactivar la suscripción push." },
      { status: 500 }
    );
  }
}