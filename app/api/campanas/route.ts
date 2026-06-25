import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizarTelefonoColombia(telefono: string | null | undefined) {
  const limpio = String(telefono || "").replace(/\D/g, "");

  // Si viene como 3012080918
  if (limpio.length === 10 && limpio.startsWith("3")) {
    return `57${limpio}`;
  }

  // Si ya viene como 573012080918
  if (limpio.length === 12 && limpio.startsWith("57")) {
    return limpio;
  }

  return null;
}

async function enviarPlantillaMeta({
  telefono,
  templateName,
  language,
  variableCount,
  nombreCliente,
}: {
  telefono: string;
  templateName: string;
  language: string;
  variableCount: number;
  nombreCliente: string;
}) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token) {
    throw new Error("Falta WHATSAPP_TOKEN en el archivo .env");
  }

  if (!phoneNumberId) {
    throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID en el archivo .env");
  }

  const template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: "body";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  } = {
    name: templateName,
    language: {
      code: language,
    },
  };

  if (variableCount === 1) {
    template.components = [
      {
        type: "body",
        parameters: [
          {
            type: "text",
            text: nombreCliente || "cliente",
          },
        ],
      },
    ];
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
        type: "template",
        template,
      }),
    }
  );

  const data = await respuesta.json();

  return {
    ok: respuesta.ok,
    status: respuesta.status,
    data,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const canal = String(body.canal || "api_oficial");
    const cliente_id = String(body.cliente_id || "");
    const nombre_plantilla = String(body.nombre_plantilla || "");
    const mensaje_enviado = String(body.mensaje_enviado || "");
    const meta_template_name = String(body.meta_template_name || "");
    const meta_template_language = String(body.meta_template_language || "es");
    const meta_variable_count = Number(body.meta_variable_count ?? 0);

    if (canal !== "api_oficial") {
      return NextResponse.json(
        {
          ok: false,
          error: "Esta ruta solo permite envíos por api_oficial.",
        },
        { status: 400 }
      );
    }

    if (!cliente_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta cliente_id.",
        },
        { status: 400 }
      );
    }

    if (!meta_template_name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta meta_template_name.",
        },
        { status: 400 }
      );
    }

    if (!meta_template_language) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta meta_template_language.",
        },
        { status: 400 }
      );
    }

    if (![0, 1].includes(meta_variable_count)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Solo se permiten plantillas con 0 o 1 variable.",
        },
        { status: 400 }
      );
    }

    const cliente = await prisma.clientes.findUnique({
      where: {
        id: cliente_id,
      },
      select: {
        id: true,
        nombre: true,
        telefono: true,
      },
    });

    if (!cliente) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cliente no encontrado.",
        },
        { status: 404 }
      );
    }

    const telefonoNormalizado = normalizarTelefonoColombia(cliente.telefono);

    if (!telefonoNormalizado) {
      const campanaFallida = await prisma.campanas_enviadas.create({
        data: {
          cliente_id: cliente.id,
          plantilla_id: null,
          nombre_cliente: cliente.nombre,
          telefono_cliente: cliente.telefono,
          nombre_plantilla: nombre_plantilla || meta_template_name,
          mensaje_enviado: mensaje_enviado || meta_template_name,
          estado: "fallida_api",
          canal: "api_oficial",
          whatsapp_message_id: null,
          estado_api: "invalid_phone",
          error_api: JSON.stringify({
            error: "Teléfono inválido. Debe ser un celular colombiano válido.",
            telefono_original: cliente.telefono,
          }),
          fecha_fallido: new Date(),
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Teléfono inválido. Debe ser un celular colombiano válido.",
          campana: campanaFallida,
        },
        { status: 400 }
      );
    }

    const resultadoApi = await enviarPlantillaMeta({
      telefono: telefonoNormalizado,
      templateName: meta_template_name,
      language: meta_template_language,
      variableCount: meta_variable_count,
      nombreCliente: cliente.nombre,
    });

    if (!resultadoApi.ok) {
      const campanaFallida = await prisma.campanas_enviadas.create({
        data: {
          cliente_id: cliente.id,
          plantilla_id: null,
          nombre_cliente: cliente.nombre,
          telefono_cliente: telefonoNormalizado,
          nombre_plantilla: nombre_plantilla || meta_template_name,
          mensaje_enviado: mensaje_enviado || meta_template_name,
          estado: "fallida_api",
          canal: "api_oficial",
          whatsapp_message_id: null,
          estado_api: "failed",
          error_api: JSON.stringify(resultadoApi.data),
          fecha_fallido: new Date(),
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Meta rechazó el envío.",
          detalle: resultadoApi.data,
          campana: campanaFallida,
        },
        { status: resultadoApi.status || 400 }
      );
    }

    const whatsappMessageId = resultadoApi.data?.messages?.[0]?.id || null;

    const estadoApi =
      resultadoApi.data?.messages?.[0]?.message_status || "accepted";

    const ahora = new Date();

    const [campanaExitosa] = await prisma.$transaction([
      prisma.campanas_enviadas.create({
        data: {
          cliente_id: cliente.id,
          plantilla_id: null,
          nombre_cliente: cliente.nombre,
          telefono_cliente: telefonoNormalizado,
          nombre_plantilla: nombre_plantilla || meta_template_name,
          mensaje_enviado: mensaje_enviado || meta_template_name,
          estado: "enviada_api",
          canal: "api_oficial",
          whatsapp_message_id: whatsappMessageId,
          estado_api: estadoApi,
          error_api: null,
          fecha_enviado_api: ahora,
        },
      }),

      prisma.clientes.update({
        where: {
          id: cliente.id,
        },
        data: {
          estado: "contactado",
          ultimo_contacto: ahora,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      mensaje: "Campaña enviada correctamente por API oficial.",
      estado_api: estadoApi,
      whatsapp_message_id: whatsappMessageId,
      campana: campanaExitosa,
      meta: resultadoApi.data,
    });
  } catch (error) {
    console.error("Error en /api/campanas:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno enviando campaña individual.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}