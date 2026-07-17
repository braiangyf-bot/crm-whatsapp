import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { notificarNuevoMensajeWhatsApp } from "@/lib/push/notificarNuevoMensajeWhatsApp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EstadoWebhook = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: unknown;
};

type ContactoWebhook = {
  wa_id?: string;
  profile?: {
    name?: string;
  };
};

type MetadataWebhook = {
  phone_number_id?: string;
  display_phone_number?: string;
};

type MensajeWebhook = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;

  context?: {
    id?: string;
  };

  text?: {
    body?: string;
  };

  image?: {
    id?: string;
    mime_type?: string;
    caption?: string;
  };

  audio?: {
    id?: string;
    mime_type?: string;
  };

  document?: {
    id?: string;
    mime_type?: string;
    filename?: string;
    caption?: string;
  };

  video?: {
    id?: string;
    mime_type?: string;
    caption?: string;
  };

  sticker?: {
    id?: string;
    mime_type?: string;
  };

  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };

  interactive?: {
    type?: string;
    button_reply?: {
      id?: string;
      title?: string;
    };
    list_reply?: {
      id?: string;
      title?: string;
      description?: string;
    };
  };

  reaction?: {
    message_id?: string;
    emoji?: string;
  };

  button?: {
    text?: string;
    payload?: string;
  };
};

type DatosMensajeExtraidos = {
  tipo: string;
  contenido: string | null;
  caption: string | null;
  contextMessageId: string | null;
  mediaId: string | null;
  mimeType: string | null;
  nombreArchivo: string | null;
  metadata: Prisma.InputJsonObject;
};

const TIPOS_MENSAJE_PERMITIDOS = new Set([
  "text",
  "image",
  "audio",
  "document",
  "video",
  "sticker",
  "location",
  "contacts",
  "interactive",
  "reaction",
  "button",
  "order",
  "system",
  "template",
  "unknown",
]);

function convertirTimestamp(timestamp?: string): Date {
  const segundos = Number(timestamp);

  if (!timestamp || !Number.isFinite(segundos)) {
    return new Date();
  }

  return new Date(segundos * 1000);
}

function normalizarTelefonoWhatsApp(
  telefono: string | null | undefined
): string | null {
  const digitos = String(telefono ?? "").replace(/\D/g, "");

  if (!/^\d{7,20}$/.test(digitos)) {
    return null;
  }

  if (/^3\d{9}$/.test(digitos)) {
    return `57${digitos}`;
  }

  return digitos;
}

function obtenerTelefonosParaBuscarCliente(
  telefonoInternacional: string
): string[] {
  const telefonos = new Set<string>();

  telefonos.add(telefonoInternacional);

  if (/^573\d{9}$/.test(telefonoInternacional)) {
    telefonos.add(telefonoInternacional.slice(2));
  }

  return Array.from(telefonos);
}

function normalizarTipoMensaje(tipo: string | undefined): string {
  const tipoNormalizado = String(tipo || "unknown")
    .trim()
    .toLowerCase();

  return TIPOS_MENSAJE_PERMITIDOS.has(tipoNormalizado)
    ? tipoNormalizado
    : "unknown";
}

function obtenerNombreContacto(
  contactos: ContactoWebhook[],
  telefonoRemitente: string
): string | null {
  const contacto =
    contactos.find(
      (item) =>
        String(item.wa_id || "").replace(/\D/g, "") ===
        telefonoRemitente
    ) || contactos[0];

  const nombre = String(contacto?.profile?.name || "")
    .trim()
    .replace(/\s+/g, " ");

  return nombre || null;
}

function extraerDatosMensaje(
  mensaje: MensajeWebhook
): DatosMensajeExtraidos {
  const tipoOriginal = String(mensaje.type || "unknown")
    .trim()
    .toLowerCase();

  let tipo = normalizarTipoMensaje(tipoOriginal);
  let contenido: string | null = null;
  let caption: string | null = null;
  let mediaId: string | null = null;
  let mimeType: string | null = null;
  let nombreArchivo: string | null = null;

  if (tipo === "text") {
    contenido = String(mensaje.text?.body || "").trim() || null;

    /*
     * La tabla exige contenido para mensajes tipo text.
     * Si Meta enviara uno vacío, se conserva como unknown.
     */
    if (!contenido) {
      tipo = "unknown";
    }
  }

  if (tipo === "image") {
    caption = String(mensaje.image?.caption || "").trim() || null;
    contenido = caption;
    mediaId = String(mensaje.image?.id || "").trim() || null;
    mimeType =
      String(mensaje.image?.mime_type || "").trim() || null;
  }

  if (tipo === "audio") {
    mediaId = String(mensaje.audio?.id || "").trim() || null;
    mimeType =
      String(mensaje.audio?.mime_type || "").trim() || null;
  }

  if (tipo === "document") {
    caption =
      String(mensaje.document?.caption || "").trim() || null;

    contenido = caption;
    mediaId = String(mensaje.document?.id || "").trim() || null;
    mimeType =
      String(mensaje.document?.mime_type || "").trim() || null;

    nombreArchivo =
      String(mensaje.document?.filename || "").trim() || null;
  }

  if (tipo === "video") {
    caption = String(mensaje.video?.caption || "").trim() || null;
    contenido = caption;
    mediaId = String(mensaje.video?.id || "").trim() || null;
    mimeType =
      String(mensaje.video?.mime_type || "").trim() || null;
  }

  if (tipo === "sticker") {
    mediaId = String(mensaje.sticker?.id || "").trim() || null;
    mimeType =
      String(mensaje.sticker?.mime_type || "").trim() || null;
  }

  if (tipo === "location") {
    const nombre =
      String(mensaje.location?.name || "").trim() || null;

    const direccion =
      String(mensaje.location?.address || "").trim() || null;

    const latitud = mensaje.location?.latitude;
    const longitud = mensaje.location?.longitude;

    contenido =
      [nombre, direccion].filter(Boolean).join(" — ") ||
      (typeof latitud === "number" &&
        typeof longitud === "number"
        ? `${latitud}, ${longitud}`
        : null);
  }

  if (tipo === "interactive") {
    contenido =
      String(
        mensaje.interactive?.button_reply?.title ||
        mensaje.interactive?.list_reply?.title ||
        mensaje.interactive?.list_reply?.description ||
        ""
      ).trim() || null;
  }

  if (tipo === "reaction") {
    contenido =
      String(mensaje.reaction?.emoji || "").trim() || null;
  }

  if (tipo === "button") {
    contenido =
      String(
        mensaje.button?.text ||
        mensaje.button?.payload ||
        ""
      ).trim() || null;
  }

  return {
    tipo,
    contenido,
    caption,
    contextMessageId:
      String(
        mensaje.context?.id ||
        mensaje.reaction?.message_id ||
        ""
      ).trim() || null,
    mediaId,
    mimeType,
    nombreArchivo,
    metadata: {
      tipo_original: tipoOriginal || "unknown",
    },
  };
}

function construirErrorMensaje(
  statusInfo: EstadoWebhook,
  whatsappMessageId: string
): Prisma.InputJsonObject {
  const errors = JSON.parse(
    JSON.stringify(statusInfo.errors || [])
  ) as Prisma.InputJsonArray;

  return {
    whatsapp_message_id: whatsappMessageId,
    errors,
    ...(statusInfo.recipient_id
      ? {
        recipient_id: statusInfo.recipient_id,
      }
      : {}),
  };
}

async function actualizarEstadoCampana(
  campana: {
    id: string;
    estado_api: string | null;
    fecha_entregado: Date | null;
  },
  statusInfo: EstadoWebhook,
  whatsappMessageId: string,
  estadoRecibido: string,
  fechaEvento: Date
): Promise<void> {
  if (estadoRecibido === "sent") {
    if (
      ["delivered", "read", "failed"].includes(
        String(campana.estado_api)
      )
    ) {
      return;
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

    return;
  }

  if (estadoRecibido === "delivered") {
    if (
      ["read", "failed"].includes(
        String(campana.estado_api)
      )
    ) {
      return;
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

    return;
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

    return;
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

    return;
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

async function actualizarEstadoMensaje(
  mensaje: {
    id: string;
    estado_api: string | null;
    fecha_entregado: Date | null;
  },
  statusInfo: EstadoWebhook,
  whatsappMessageId: string,
  estadoRecibido: string,
  fechaEvento: Date
): Promise<void> {
  if (estadoRecibido === "accepted") {
    if (
      ["sent", "delivered", "read", "failed"].includes(
        String(mensaje.estado_api)
      )
    ) {
      return;
    }

    await prisma.mensajes_whatsapp.update({
      where: {
        id: mensaje.id,
      },
      data: {
        estado_api: "accepted",
        fecha_aceptado: fechaEvento,
      },
    });

    return;
  }

  if (estadoRecibido === "sent") {
    if (
      ["delivered", "read", "failed"].includes(
        String(mensaje.estado_api)
      )
    ) {
      return;
    }

    await prisma.mensajes_whatsapp.update({
      where: {
        id: mensaje.id,
      },
      data: {
        estado_api: "sent",
        fecha_enviado: fechaEvento,
      },
    });

    return;
  }

  if (estadoRecibido === "delivered") {
    if (
      ["read", "failed"].includes(
        String(mensaje.estado_api)
      )
    ) {
      return;
    }

    await prisma.mensajes_whatsapp.update({
      where: {
        id: mensaje.id,
      },
      data: {
        estado_api: "delivered",
        fecha_entregado: fechaEvento,
      },
    });

    return;
  }

  if (estadoRecibido === "read") {
    if (mensaje.estado_api === "failed") {
      return;
    }

    await prisma.mensajes_whatsapp.update({
      where: {
        id: mensaje.id,
      },
      data: {
        estado_api: "read",
        fecha_leido: fechaEvento,
        fecha_entregado:
          mensaje.fecha_entregado || fechaEvento,
      },
    });

    return;
  }

  if (estadoRecibido === "failed") {
    await prisma.mensajes_whatsapp.update({
      where: {
        id: mensaje.id,
      },
      data: {
        estado_api: "failed",
        fecha_fallido: fechaEvento,
        error_api: construirErrorMensaje(
          statusInfo,
          whatsappMessageId
        ),
      },
    });

    return;
  }

  await prisma.mensajes_whatsapp.update({
    where: {
      id: mensaje.id,
    },
    data: {
      estado_api: estadoRecibido,
    },
  });
}

async function procesarEstado(
  statusInfo: EstadoWebhook
): Promise<void> {
  const whatsappMessageId = String(statusInfo.id || "").trim();
  const estadoRecibido = String(
    statusInfo.status || ""
  )
    .trim()
    .toLowerCase();

  if (!whatsappMessageId || !estadoRecibido) {
    return;
  }

  const fechaEvento = convertirTimestamp(statusInfo.timestamp);

  const [campana, mensaje] = await Promise.all([
    prisma.campanas_enviadas.findFirst({
      where: {
        whatsapp_message_id: whatsappMessageId,
      },
      select: {
        id: true,
        estado_api: true,
        fecha_entregado: true,
      },
    }),

    prisma.mensajes_whatsapp.findUnique({
      where: {
        whatsapp_message_id: whatsappMessageId,
      },
      select: {
        id: true,
        estado_api: true,
        fecha_entregado: true,
      },
    }),
  ]);

  if (!campana && !mensaje) {
    console.warn(
      "No existe un envío registrado para el estado recibido."
    );

    return;
  }

  if (campana) {
    await actualizarEstadoCampana(
      campana,
      statusInfo,
      whatsappMessageId,
      estadoRecibido,
      fechaEvento
    );
  }

  if (mensaje) {
    await actualizarEstadoMensaje(
      mensaje,
      statusInfo,
      whatsappMessageId,
      estadoRecibido,
      fechaEvento
    );
  }
}

async function procesarMensajeEntrante({
  mensaje,
  contactos,
  metadata,
}: {
  mensaje: MensajeWebhook;
  contactos: ContactoWebhook[];
  metadata: MetadataWebhook;
}): Promise<"creado" | "duplicado" | "omitido"> {
  const whatsappMessageId = String(mensaje.id || "").trim();

  const phoneNumberId = String(
    metadata.phone_number_id || ""
  ).trim();

  const telefonoCliente = normalizarTelefonoWhatsApp(
    mensaje.from
  );

  if (
    !whatsappMessageId ||
    !phoneNumberId ||
    !telefonoCliente
  ) {
    console.warn(
      "Mensaje entrante omitido por datos incompletos."
    );

    return "omitido";
  }

  const fechaMensaje = convertirTimestamp(mensaje.timestamp);

  const nombreContacto = obtenerNombreContacto(
    contactos,
    telefonoCliente
  );

  const datosMensaje = extraerDatosMensaje(mensaje);

  try {
    const datosNotificacion = await prisma.$transaction(async (tx) => {
      const numeroWhatsApp =
        await tx.numeros_whatsapp.upsert({
          where: {
            phone_number_id: phoneNumberId,
          },
          create: {
            phone_number_id: phoneNumberId,
            telefono_mostrado:
              String(
                metadata.display_phone_number || ""
              ).trim() || null,
            activo: true,
            es_predeterminado: false,
          },
          update: {
            activo: true,
            telefono_mostrado:
              String(
                metadata.display_phone_number || ""
              ).trim() || undefined,
          },
          select: {
            id: true,
          },
        });

      const telefonosCliente =
        obtenerTelefonosParaBuscarCliente(
          telefonoCliente
        );

      const cliente = await tx.clientes.findFirst({
        where: {
          telefono: {
            in: telefonosCliente,
          },
        },
        select: {
          id: true,
          nombre: true,
        },
      });

      const nombreCliente =
        nombreContacto || cliente?.nombre || null;

      const conversacion =
        await tx.conversaciones_whatsapp.upsert({
          where: {
            numero_whatsapp_id_telefono_cliente: {
              numero_whatsapp_id: numeroWhatsApp.id,
              telefono_cliente: telefonoCliente,
            },
          },
          create: {
            numero_whatsapp_id: numeroWhatsApp.id,
            cliente_id: cliente?.id || null,
            telefono_cliente: telefonoCliente,
            nombre_cliente: nombreCliente,
            estado: "abierta",
          },
          update: {
            cliente_id: cliente?.id || undefined,
            nombre_cliente: nombreCliente || undefined,
          },
          select: {
            id: true,
          },
        });

      /*
       * La restricción única por whatsapp_message_id evita
       * duplicados si Meta reintenta el mismo webhook.
       *
       * El trigger de PostgreSQL actualiza la conversación e
       * incrementa no_leidos únicamente cuando este INSERT
       * realmente ocurre.
       */
      const mensajeCreado = await tx.mensajes_whatsapp.create({
        data: {
          conversacion_id: conversacion.id,
          whatsapp_message_id: whatsappMessageId,
          context_message_id:
            datosMensaje.contextMessageId,
          direccion: "entrante",
          tipo: datosMensaje.tipo,
          origen: "cliente",
          contenido: datosMensaje.contenido,
          caption: datosMensaje.caption,
          estado_api: "received",
          fecha_mensaje: fechaMensaje,
          timestamp_meta: fechaMensaje,
          media_id: datosMensaje.mediaId,
          mime_type: datosMensaje.mimeType,
          nombre_archivo:
            datosMensaje.nombreArchivo,
          metadata: datosMensaje.metadata,
        },
        select: {
          contenido: true,
          tipo: true,
        },
      });

      return {
        conversacionId: conversacion.id,
        nombreCliente,
        telefonoCliente,
        contenido: mensajeCreado.contenido,
        tipo: mensajeCreado.tipo,
      };
    });

    await notificarNuevoMensajeWhatsApp({
      conversacionId: datosNotificacion.conversacionId,
      nombreCliente: datosNotificacion.nombreCliente,
      telefonoCliente: datosNotificacion.telefonoCliente,
      contenido: datosNotificacion.contenido,
      tipo: datosNotificacion.tipo,
    });

    return "creado";
  } catch (error) {
    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicado";
    }

    throw error;
  }
}

// Meta utiliza GET para verificar la URL del webhook.
export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error(
      "Falta WHATSAPP_WEBHOOK_VERIFY_TOKEN en .env"
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Token de verificación no configurado.",
      },
      { status: 500 }
    );
  }

  if (
    mode === "subscribe" &&
    token === verifyToken &&
    challenge
  ) {
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

// Meta utiliza POST para enviar estados y mensajes.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entries = Array.isArray(body?.entry)
      ? body.entry
      : [];

    let mensajesNuevos = 0;
    let mensajesDuplicados = 0;
    let mensajesOmitidos = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes)
        ? entry.changes
        : [];

      for (const change of changes) {
        const value = change?.value || {};

        const statuses: EstadoWebhook[] = Array.isArray(
          value.statuses
        )
          ? value.statuses
          : [];

        for (const statusInfo of statuses) {
          if (statusInfo.status === "failed") {
            const statusConDetalle = statusInfo as EstadoWebhook & {
              errors?: unknown;
              conversation?: unknown;
              pricing?: unknown;
            };

            console.error(
              "WhatsApp marcó mensaje como fallido:",
              JSON.stringify(
                {
                  messageId: statusConDetalle.id,
                  recipientId: statusConDetalle.recipient_id,
                  timestamp: statusConDetalle.timestamp,
                  errors: statusConDetalle.errors,
                  conversation: statusConDetalle.conversation,
                  pricing: statusConDetalle.pricing,
                },
                null,
                2,
              ),
            );
          }

          await procesarEstado(statusInfo);
        }

        const mensajes: MensajeWebhook[] = Array.isArray(
          value.messages
        )
          ? value.messages
          : [];

        const contactos: ContactoWebhook[] = Array.isArray(
          value.contacts
        )
          ? value.contacts
          : [];

        const metadata: MetadataWebhook =
          typeof value.metadata === "object" &&
            value.metadata !== null
            ? value.metadata
            : {};

        for (const mensaje of mensajes) {
          const resultado =
            await procesarMensajeEntrante({
              mensaje,
              contactos,
              metadata,
            });

          if (resultado === "creado") {
            mensajesNuevos += 1;
          }

          if (resultado === "duplicado") {
            mensajesDuplicados += 1;
          }

          if (resultado === "omitido") {
            mensajesOmitidos += 1;
          }
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        recibido: true,
        mensajes_nuevos: mensajesNuevos,
        mensajes_duplicados: mensajesDuplicados,
        mensajes_omitidos: mensajesOmitidos,
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