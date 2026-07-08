import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RespuestaMeta = {
  messages?: Array<{
    id?: string;
  }>;
  error?: unknown;
};

function normalizarTelefonoColombia(telefono: string | null | undefined) {
  const limpio = String(telefono || "").replace(/\D/g, "");

  if (limpio.length === 10 && limpio.startsWith("3")) {
    return `57${limpio}`;
  }

  if (limpio.length === 12 && limpio.startsWith("57")) {
    return limpio;
  }

  return null;
}

function convertirJsonSeguro(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

function extraerTexto(valor: unknown): string {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim();
}

async function enviarTextoMeta({
  phoneNumberId,
  telefono,
  mensaje,
}: {
  phoneNumberId: string;
  telefono: string;
  mensaje: string;
}) {
  const token = process.env.WHATSAPP_TOKEN;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token) {
    throw new Error("Falta WHATSAPP_TOKEN en el archivo .env");
  }

  const respuesta = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: {
          preview_url: false,
          body: mensaje,
        },
      }),
    },
  );

  const data = (await respuesta.json()) as RespuestaMeta;

  return {
    ok: respuesta.ok,
    status: respuesta.status,
    data,
  };
}

async function buscarMensajePorIdempotencia(idempotencyKey: string) {
  return prisma.mensajes_whatsapp.findUnique({
    where: {
      idempotency_key: idempotencyKey,
    },
    select: {
      id: true,
      whatsapp_message_id: true,
      estado_api: true,
      error_api: true,
      fecha_mensaje: true,
    },
  });
}

export async function POST(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const body = await request.json();

    const conversacionId = extraerTexto(body.conversacion_id);
    const mensaje = extraerTexto(body.mensaje);
    const idempotencyKey = extraerTexto(body.idempotency_key);

    if (!conversacionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta conversacion_id.",
        },
        { status: 400 },
      );
    }

    if (!mensaje) {
      return NextResponse.json(
        {
          ok: false,
          error: "El mensaje no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    if (mensaje.length > 4096) {
      return NextResponse.json(
        {
          ok: false,
          error: "El mensaje no puede superar 4096 caracteres.",
        },
        { status: 400 },
      );
    }

    if (!idempotencyKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta idempotency_key.",
        },
        { status: 400 },
      );
    }

    const mensajeExistente =
      await buscarMensajePorIdempotencia(idempotencyKey);

    if (mensajeExistente) {
      return NextResponse.json({
        ok: true,
        duplicado: true,
        mensaje: mensajeExistente,
      });
    }

    const conversacion =
      await prisma.conversaciones_whatsapp.findUnique({
        where: {
          id: conversacionId,
        },
        select: {
          id: true,
          estado: true,
          telefono_cliente: true,
          ventana_atencion_hasta: true,
          numeros_whatsapp: {
            select: {
              phone_number_id: true,
              activo: true,
            },
          },
        },
      });

    if (!conversacion) {
      return NextResponse.json(
        {
          ok: false,
          error: "Conversación no encontrada.",
        },
        { status: 404 },
      );
    }

    if (conversacion.estado !== "abierta") {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no está abierta.",
        },
        { status: 400 },
      );
    }

    if (!conversacion.numeros_whatsapp.activo) {
      return NextResponse.json(
        {
          ok: false,
          error: "El número de WhatsApp asociado está inactivo.",
        },
        { status: 400 },
      );
    }

    if (!conversacion.numeros_whatsapp.phone_number_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no tiene phone_number_id asociado.",
        },
        { status: 400 },
      );
    }
    if (
      conversacion.numeros_whatsapp.phone_number_id ===
      "PHONE_NUMBER_ID_PRUEBA_LOCAL"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esta conversación usa un phone_number_id de prueba local. No se enviará a Meta.",
        },
        { status: 400 },
      );
    }

    const ahora = new Date();

    if (
      !conversacion.ventana_atencion_hasta ||
      conversacion.ventana_atencion_hasta <= ahora
    ) {
      return NextResponse.json(
        {
          ok: false,
          requiere_plantilla: true,
          error:
            "La ventana de atención de 24 horas está cerrada. Para escribir a este contacto se debe usar una plantilla oficial.",
        },
        { status: 400 },
      );
    }

    const telefonoNormalizado = normalizarTelefonoColombia(
      conversacion.telefono_cliente,
    );

    let mensajeCreado;

    try {
      mensajeCreado = await prisma.mensajes_whatsapp.create({
        data: {
          conversacion_id: conversacion.id,
          idempotency_key: idempotencyKey,
          direccion: "saliente",
          tipo: "text",
          origen: "respuesta_libre",
          contenido: mensaje,
          estado_api: telefonoNormalizado ? "pending" : "invalid_phone",
          fecha_mensaje: ahora,
          fecha_fallido: telefonoNormalizado ? null : ahora,
          error_api: telefonoNormalizado
            ? undefined
            : convertirJsonSeguro({
              telefono_original: conversacion.telefono_cliente,
            }),
        },
        select: {
          id: true,
          whatsapp_message_id: true,
          estado_api: true,
          error_api: true,
          fecha_mensaje: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const mensajeDuplicado =
          await buscarMensajePorIdempotencia(idempotencyKey);

        if (mensajeDuplicado) {
          return NextResponse.json({
            ok: true,
            duplicado: true,
            mensaje: mensajeDuplicado,
          });
        }
      }

      throw error;
    }

    if (!telefonoNormalizado) {
      return NextResponse.json(
        {
          ok: false,
          error: "El teléfono de la conversación no es válido para Colombia.",
          mensaje: mensajeCreado,
        },
        { status: 400 },
      );
    }

    const respuestaMeta = await enviarTextoMeta({
      phoneNumberId: conversacion.numeros_whatsapp.phone_number_id,
      telefono: telefonoNormalizado,
      mensaje,
    });

    const whatsappMessageId =
      respuestaMeta.data.messages?.[0]?.id ?? null;

    if (!respuestaMeta.ok) {
      const mensajeFallido =
        await prisma.mensajes_whatsapp.update({
          where: {
            id: mensajeCreado.id,
          },
          data: {
            estado_api: "failed",
            error_api: convertirJsonSeguro(respuestaMeta.data),
            fecha_fallido: new Date(),
          },
          select: {
            id: true,
            whatsapp_message_id: true,
            estado_api: true,
            error_api: true,
            fecha_mensaje: true,
          },
        });

      return NextResponse.json(
        {
          ok: false,
          error: "Meta rechazó el envío del mensaje.",
          meta_status: respuestaMeta.status,
          meta: respuestaMeta.data,
          mensaje: mensajeFallido,
        },
        { status: 502 },
      );
    }

    const mensajeActualizado =
      await prisma.mensajes_whatsapp.update({
        where: {
          id: mensajeCreado.id,
        },
        data: {
          whatsapp_message_id: whatsappMessageId,
          estado_api: "accepted",
          error_api: Prisma.JsonNull,
          fecha_aceptado: new Date(),
        },
        select: {
          id: true,
          whatsapp_message_id: true,
          estado_api: true,
          error_api: true,
          fecha_mensaje: true,
        },
      });

    return NextResponse.json({
      ok: true,
      duplicado: false,
      mensaje: mensajeActualizado,
      meta: respuestaMeta.data,
    });
  } catch (error) {
    console.error("Error en /api/whatsapp/responder", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno al responder por WhatsApp.",
      },
      { status: 500 },
    );
  }
}
