import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: {
    body_text_named_params?: Array<{
      param_name?: string;
      example?: string;
    }>;
  };
};

type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: MetaTemplateComponent[];
};

function obtenerVariablesPorTexto(texto: string) {
  const variables = Array.from(
    texto.matchAll(/\{\{([a-z0-9_]+)\}\}/g)
  );

  return variables.map((variable) => variable[1]);
}

function obtenerVariablesPorEjemplo(
  componente?: MetaTemplateComponent
) {
  return (
    componente?.example?.body_text_named_params
      ?.map((parametro) => String(parametro.param_name ?? "").trim())
      .filter((nombre) => /^[a-z0-9_]+$/.test(nombre)) ?? []
  );
}

function obtenerVariablesBody(
  bodyText: string,
  componente?: MetaTemplateComponent
) {
  const variablesPorEjemplo = obtenerVariablesPorEjemplo(componente);

  if (variablesPorEjemplo.length > 0) {
    return variablesPorEjemplo;
  }

  return obtenerVariablesPorTexto(bodyText);
}

export async function GET() {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const token = process.env.WHATSAPP_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";

    if (!token || !wabaId) {
      return NextResponse.json(
        { error: "Faltan variables de entorno de WhatsApp." },
        { status: 500 }
      );
    }

    const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?fields=name,language,status,category,components`;

    const respuesta = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      return NextResponse.json(
        {
          error: "Error consultando plantillas de Meta.",
          detalle: data,
        },
        { status: respuesta.status }
      );
    }

    const plantillasAprobadas = ((data.data || []) as MetaTemplate[])
      .filter((plantilla) => plantilla.status?.toUpperCase() === "APPROVED")
      .map((plantilla) => {
        const cuerpo = plantilla.components?.find(
          (component) => component.type === "BODY"
        );

        const tieneImagen = plantilla.components?.some(
          (component) => component.type === "HEADER" && component.format === "IMAGE"
        );

        const tieneVideo = plantilla.components?.some(
          (component) => component.type === "HEADER" && component.format === "VIDEO"
        );

        const tieneDocumento = plantilla.components?.some(
          (component) => component.type === "HEADER" && component.format === "DOCUMENT"
        );

        const tieneCarousel = plantilla.components?.some(
          (component) => component.type === "CAROUSEL"
        );

        const bodyText = cuerpo?.text || "";
        const variableNames = obtenerVariablesBody(bodyText, cuerpo);
        const variableCount = variableNames.length;

        return {
          name: plantilla.name,
          language: plantilla.language,
          status: plantilla.status,
          category: plantilla.category,
          bodyText,
          variableCount,
          variableNames,
          tieneMultimedia:
            Boolean(tieneImagen) ||
            Boolean(tieneVideo) ||
            Boolean(tieneDocumento) ||
            Boolean(tieneCarousel),
          components: plantilla.components || [],
        };
      })
      .filter((plantilla) => !plantilla.tieneMultimedia)
      .filter((plantilla) => plantilla.variableCount <= 20);

    return NextResponse.json({
      ok: true,
      total: plantillasAprobadas.length,
      plantillas: plantillasAprobadas,
    });
  } catch (error) {
    console.error("ERROR CONSULTANDO PLANTILLAS META:", error);

    return NextResponse.json(
      {
        error: "Error interno consultando plantillas de Meta.",
        detalle: String(error),
      },
      { status: 500 }
    );
  }
}