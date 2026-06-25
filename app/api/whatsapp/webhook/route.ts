import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EstadoWebhook = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: unknown;
};

function convertirTimestamp(timestamp?: string) {
  const segundos = Number(timestamp);

  if (!timestamp || !Number.isFinite(segundos)) {
    return new Date();
  }

  return new Date(segundos * 1000);
}

// Meta utiliza GET para verificar la URL del webhook.
export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("Falta WHATSAPP_WEBHOOK_VERIFY_TOKEN en .env");

    return NextResponse.json(
      {
        ok: false,
        error: "Token de verificación no configurado.",
      },
      { status: 500 }
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Webhook de WhatsApp verificado.");

    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Verificación rechazada.",
    },
    { status: 403 }
  );
}

// Meta utiliza POST para enviar estados de mensajes.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entries = Array.isArray(body?.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const statuses: EstadoWebhook[] = Array.isArray(
          change?.value?.statuses
        )
          ? change.value.statuses
          : [];

        for (const statusInfo of statuses) {
          const whatsappMessageId = String(statusInfo.id || "");
          const estadoRecibido = String(statusInfo.status || "");
          const fechaEvento = convertirTimestamp(statusInfo.timestamp);

          if (!whatsappMessageId || !estadoRecibido) {
            continue;
          }

          const campana = await prisma.campanas_enviadas.findFirst({
            where: {
              whatsapp_message_id: whatsappMessageId,
            },
            select: {
              id: true,
              estado_api: true,
              fecha_entregado: true,
            },
          });

          if (!campana) {
            console.warn(
              `No existe campaña para el mensaje ${whatsappMessageId}`
            );
            continue;
          }

          if (estadoRecibido === "sent") {
            // Evita devolver un mensaje leído o entregado a estado sent.
            if (
              ["delivered", "read", "failed"].includes(
                String(campana.estado_api)
              )
            ) {
              continue;
            }

            await prisma.campanas_enviadas.update({
              where: {
                id: campana.id,
              },
              data: {
                estado: "enviada_api",
                estado_api: "sent",
              },
            });

            continue;
          }

          if (estadoRecibido === "delivered") {
            // Evita devolver un mensaje leído a estado delivered.
            if (["read", "failed"].includes(String(campana.estado_api))) {
              continue;
            }

            await prisma.campanas_enviadas.update({
              where: {
                id: campana.id,
              },
              data: {
                estado: "enviada_api",
                estado_api: "delivered",
                fecha_entregado: fechaEvento,
              },
            });

            continue;
          }

          if (estadoRecibido === "read") {
            await prisma.campanas_enviadas.update({
              where: {
                id: campana.id,
              },
              data: {
                estado: "enviada_api",
                estado_api: "read",
                fecha_leido: fechaEvento,
                fecha_entregado:
                  campana.fecha_entregado || fechaEvento,
              },
            });

            continue;
          }

          if (estadoRecibido === "failed") {
            await prisma.campanas_enviadas.update({
              where: {
                id: campana.id,
              },
              data: {
                estado: "fallida_api",
                estado_api: "failed",
                fecha_fallido: fechaEvento,
                error_api: JSON.stringify({
                  errors: statusInfo.errors || [],
                  recipient_id: statusInfo.recipient_id || null,
                  whatsapp_message_id: whatsappMessageId,
                }),
              },
            });

            continue;
          }

          await prisma.campanas_enviadas.update({
            where: {
              id: campana.id,
            },
            data: {
              estado_api: estadoRecibido,
            },
          });
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        recibido: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error procesando webhook:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error procesando webhook.",
      },
      { status: 500 }
    );
  }
}