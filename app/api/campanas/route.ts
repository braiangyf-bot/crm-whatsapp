import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

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

function normalizarVariablesBody(valor: unknown): string[] {
  if (typeof valor === "string") {
    const texto = valor.trim();

    if (!texto) {
      return [];
    }

    try {
      return normalizarVariablesBody(JSON.parse(texto));
    } catch {
      return [texto];
    }
  }

  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.map((item) => String(item ?? "").trim());
}

function normalizarNombresVariablesBody(valor: unknown): string[] {
  if (typeof valor === "string") {
    const texto = valor.trim();

    if (!texto) {
      return [];
    }

    try {
      return normalizarNombresVariablesBody(JSON.parse(texto));
    } catch {
      return /^[a-z0-9_]+$/.test(texto) ? [texto] : [];
    }
  }

  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map((item) => String(item ?? "").trim())
    .filter((nombre) => /^[a-z0-9_]+$/.test(nombre));
}

type ResultadoSubidaMedia =
  | {
      ok: true;
      mediaId: string;
      data: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
      data: unknown;
    };

async function subirImagenHeaderMeta(
  archivo: File
): Promise<ResultadoSubidaMedia> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token) {
    return {
      ok: false,
      status: 500,
      error: "Falta WHATSAPP_TOKEN en el archivo .env",
      data: null,
    };
  }

  if (!phoneNumberId) {
    return {
      ok: false,
      status: 500,
      error: "Falta WHATSAPP_PHONE_NUMBER_ID en el archivo .env",
      data: null,
    };
  }

  const tipoArchivo = archivo.type || "";

  if (!["image/jpeg", "image/png"].includes(tipoArchivo)) {
    return {
      ok: false,
      status: 400,
      error: "La imagen del encabezado debe ser JPG o PNG.",
      data: {
        tipo_archivo: tipoArchivo,
      },
    };
  }

  if (archivo.size > 4 * 1024 * 1024) {
    return {
      ok: false,
      status: 400,
      error:
        "La imagen pesa más de 4 MB. Comprime la imagen antes de enviarla.",
      data: {
        tamano: archivo.size,
      },
    };
  }

  const formData = new FormData();

  formData.append("messaging_product", "whatsapp");
  formData.append("type", tipoArchivo);
  formData.append(
    "file",
    archivo,
    archivo.name || (tipoArchivo === "image/png" ? "header.png" : "header.jpg")
  );

  const respuesta = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await respuesta.json().catch(() => null);

  const mediaId =
    data && typeof data === "object" && "id" in data
      ? String((data as { id?: unknown }).id || "")
      : "";

  if (!respuesta.ok || !mediaId) {
    return {
      ok: false,
      status: respuesta.status,
      error: "Meta rechazó la subida de la imagen del encabezado.",
      data,
    };
  }

  return {
    ok: true,
    mediaId,
    data,
  };
}

type ParametroTextoPlantilla = {
  type: "text";
  text: string;
  parameter_name?: string;
};

type ParametroImagenPlantilla = {
  type: "image";
  image: {
    id: string;
  };
};

type ComponentePlantilla =
  | {
      type: "header";
      parameters: ParametroImagenPlantilla[];
    }
  | {
      type: "body";
      parameters: ParametroTextoPlantilla[];
    };

async function enviarPlantillaMeta({
  telefono,
  templateName,
  language,
  variableCount,
  nombreCliente,
  bodyVariables,
  bodyVariableNames,
  headerImageMediaId,
}: {
  telefono: string;
  templateName: string;
  language: string;
  variableCount: number;
  nombreCliente: string;
  bodyVariables: string[];
  bodyVariableNames: string[];
  headerImageMediaId?: string | null;
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

  const components: ComponentePlantilla[] = [];

  if (headerImageMediaId) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: {
            id: headerImageMediaId,
          },
        },
      ],
    });
  }

  if (variableCount === 1) {
    const textoVariable =
      bodyVariables[0]?.trim() || nombreCliente || "cliente";

    const parameterName = bodyVariableNames[0]?.trim();

    const parametro: ParametroTextoPlantilla = {
      type: "text",
      text: textoVariable,
    };

    if (parameterName && !/^\d+$/.test(parameterName)) {
      parametro.parameter_name = parameterName;
    }

    components.push({
      type: "body",
      parameters: [parametro],
    });
  }

  const template: {
    name: string;
    language: {
      code: string;
    };
    components?: ComponentePlantilla[];
  } = {
    name: templateName,
    language: {
      code: language,
    },
  };

  if (components.length > 0) {
    template.components = components;
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
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    const esFormulario = contentType
      .toLowerCase()
      .includes("multipart/form-data");

    const formData = esFormulario ? await request.formData() : null;

    const body: Record<string, unknown> = formData
      ? Object.fromEntries(formData.entries())
      : await request.json();

    const archivoHeader = formData?.get("meta_header_image_file");

    const meta_header_image_file =
      archivoHeader instanceof File && archivoHeader.size > 0
        ? archivoHeader
        : null;

    const canal = String(body.canal || "api_oficial");
    const cliente_id = String(body.cliente_id || "");
    const nombre_plantilla = String(body.nombre_plantilla || "");
    const mensaje_enviado = String(body.mensaje_enviado || "");
    const meta_template_name = String(body.meta_template_name || "");
    const meta_template_language = String(body.meta_template_language || "es");
    const meta_variable_count = Number(body.meta_variable_count ?? 0);
    const meta_body_variables = normalizarVariablesBody(
      body.meta_body_variables
    );

    const meta_variable_names = normalizarNombresVariablesBody(
      body.meta_variable_names
    );

    const meta_header_format = String(
      body.meta_header_format || ""
    ).toUpperCase();

    const requiereImagenHeader =
      meta_header_format === "IMAGE" ||
      meta_template_name === "promocion_limpieza_facial";

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
        estado: true,
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

    if (cliente.estado === "no_responde") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este cliente está marcado como No responde. No se enviará campaña.",
          codigo: "cliente_no_responde",
          cliente: {
            id: cliente.id,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            estado: cliente.estado,
          },
        },
        { status: 409 }
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

    let headerImageMediaId: string | null = null;

    if (requiereImagenHeader) {
      if (!meta_header_image_file) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Esta plantilla requiere una imagen de encabezado. Adjunta una imagen JPG o PNG antes de enviarla.",
            codigo: "template_header_image_required",
          },
          { status: 400 }
        );
      }

      const resultadoSubidaImagen = await subirImagenHeaderMeta(
        meta_header_image_file
      );

      if (!resultadoSubidaImagen.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: resultadoSubidaImagen.error,
            detalle: resultadoSubidaImagen.data,
            codigo: "template_header_image_upload_failed",
          },
          { status: resultadoSubidaImagen.status || 400 }
        );
      }

      headerImageMediaId = resultadoSubidaImagen.mediaId;
    }

    const resultadoApi = await enviarPlantillaMeta({
      telefono: telefonoNormalizado,
      templateName: meta_template_name,
      language: meta_template_language,
      variableCount: meta_variable_count,
      nombreCliente: cliente.nombre,
      bodyVariables: meta_body_variables,
      bodyVariableNames: meta_variable_names,
      headerImageMediaId,
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