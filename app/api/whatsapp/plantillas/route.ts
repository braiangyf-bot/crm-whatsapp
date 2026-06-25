import { NextResponse } from "next/server";

type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
};

type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: MetaTemplateComponent[];
};

function contarVariables(texto: string) {
  const variables = texto.match(/{{\d+}}/g);
  return variables ? variables.length : 0;
}

export async function GET() {
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
        const variableCount = contarVariables(bodyText);

        return {
          name: plantilla.name,
          language: plantilla.language,
          status: plantilla.status,
          category: plantilla.category,
          bodyText,
          variableCount,
          tieneMultimedia:
            Boolean(tieneImagen) ||
            Boolean(tieneVideo) ||
            Boolean(tieneDocumento) ||
            Boolean(tieneCarousel),
          components: plantilla.components || [],
        };
      })
      .filter((plantilla) => !plantilla.tieneMultimedia)
      .filter((plantilla) => plantilla.variableCount <= 1);

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