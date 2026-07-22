import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";

const estadosPermitidos = [
  "",
  "pendiente",
  "contactado",
  "interesado",
  "cliente",
  "no_responde",
] as const;

type EstadoComercial = (typeof estadosPermitidos)[number];

function esEstadoPermitido(estado: unknown): estado is EstadoComercial {
  return (
    typeof estado === "string" &&
    estadosPermitidos.includes(estado as EstadoComercial)
  );
}

function obtenerMetadataComoObjeto(
  metadata: Prisma.JsonValue,
): Record<string, Prisma.JsonValue> {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, Prisma.JsonValue>;
  }

  return {};
}

function soloNumeros(valor: string | null): string {
  return (valor ?? "").replace(/\D/g, "");
}

function crearTelefonosPosibles(telefono: string | null): string[] {
  const limpio = soloNumeros(telefono);

  if (!limpio) {
    return [];
  }

  const sinCodigoColombia =
    limpio.startsWith("57") && limpio.length > 10
      ? limpio.slice(2)
      : limpio;

  return Array.from(
    new Set([
      limpio,
      sinCodigoColombia,
      `57${sinCodigoColombia}`,
      `+57${sinCodigoColombia}`,
    ]),
  );
}

export async function PATCH(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      conversacion_id?: unknown;
      etiqueta?: unknown;
    } | null;

    const conversacionId = body?.conversacion_id;
    const estadoComercial = body?.etiqueta;

    if (typeof conversacionId !== "string" || !conversacionId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta el ID de la conversación.",
        },
        { status: 400 },
      );
    }

    if (!esEstadoPermitido(estadoComercial)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Estado comercial inválido.",
        },
        { status: 400 },
      );
    }

    const conversacionActual =
      await prisma.conversaciones_whatsapp.findUnique({
        where: {
          id: conversacionId,
        },
        select: {
          id: true,
          cliente_id: true,
          telefono_cliente: true,
          metadata: true,
        },
      });

    if (!conversacionActual) {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no existe.",
        },
        { status: 404 },
      );
    }

    const metadataActual = obtenerMetadataComoObjeto(
      conversacionActual.metadata,
    );

    const metadataActualizada = {
      ...metadataActual,
    };

    if (estadoComercial) {
      metadataActualizada.etiqueta_comercial = estadoComercial;
    } else {
      delete metadataActualizada.etiqueta_comercial;
    }

    let clienteIdParaActualizar = conversacionActual.cliente_id;

    if (!clienteIdParaActualizar) {
      const telefonosPosibles = crearTelefonosPosibles(
        conversacionActual.telefono_cliente,
      );

      const clienteEncontrado = telefonosPosibles.length
        ? await prisma.clientes.findFirst({
            where: {
              telefono: {
                in: telefonosPosibles,
              },
            },
            select: {
              id: true,
            },
          })
        : null;

      clienteIdParaActualizar = clienteEncontrado?.id ?? null;
    }

    const operaciones: Prisma.PrismaPromise<unknown>[] = [
      prisma.conversaciones_whatsapp.update({
        where: {
          id: conversacionId,
        },
        data: {
          metadata: metadataActualizada,
          ...(clienteIdParaActualizar
            ? {
                cliente_id: clienteIdParaActualizar,
              }
            : {}),
        },
        select: {
          id: true,
          cliente_id: true,
          metadata: true,
        },
      }),
    ];

    if (clienteIdParaActualizar && estadoComercial) {
      operaciones.push(
        prisma.clientes.update({
          where: {
            id: clienteIdParaActualizar,
          },
          data: {
            estado: estadoComercial,
            ultimo_contacto: new Date(),
          },
          select: {
            id: true,
            estado: true,
          },
        }),
      );
    }

    await prisma.$transaction(operaciones);

    return NextResponse.json({
      ok: true,
      cliente_actualizado: Boolean(clienteIdParaActualizar && estadoComercial),
      cliente_id: clienteIdParaActualizar,
    });
  } catch (error) {
    console.error("Error cambiando estado comercial:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cambiar el estado comercial.",
      },
      { status: 500 },
    );
  }
}