import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";

const estadosPermitidos = ["abierta", "cerrada", "archivada"] as const;

type EstadoConversacion = (typeof estadosPermitidos)[number];

function esEstadoPermitido(
  estado: unknown
): estado is EstadoConversacion {
  return (
    typeof estado === "string" &&
    estadosPermitidos.includes(estado as EstadoConversacion)
  );
}

export async function PATCH(request: Request) {
  await exigirUsuarioApi();

  try {
    const body = (await request.json().catch(() => null)) as {
      conversacion_id?: unknown;
      estado?: unknown;
    } | null;

    const conversacionId = body?.conversacion_id;
    const estado = body?.estado;

    if (typeof conversacionId !== "string" || !conversacionId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta el ID de la conversación.",
        },
        {
          status: 400,
        }
      );
    }

    if (!esEstadoPermitido(estado)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Estado de conversación inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const conversacion = await prisma.conversaciones_whatsapp.update({
      where: {
        id: conversacionId,
      },
      data:
        estado === "abierta"
          ? {
              estado,
              cerrada_at: null,
            }
          : {
              estado,
              cerrada_at: new Date(),
            },
      select: {
        id: true,
        estado: true,
        cerrada_at: true,
      },
    });

    return NextResponse.json({
      ok: true,
      conversacion,
    });
  } catch (error) {
    console.error("Error cambiando estado de conversación:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no existe.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cambiar el estado de la conversación.",
      },
      {
        status: 500,
      }
    );
  }
}