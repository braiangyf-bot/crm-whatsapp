import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const telefono = String(body.telefono || "").replace(/\D/g, "");

    if (!telefono) {
      return NextResponse.json(
        { error: "Falta el teléfono del destinatario." },
        { status: 400 }
      );
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";

    if (!token || !phoneNumberId) {
      return NextResponse.json(
        { error: "Faltan variables de entorno de WhatsApp." },
        { status: 500 }
      );
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "template",
        template: {
          name: "jaspers_market_order_confirmation_v1",
          language: {
            code: "en_US",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: "John Doe",
                },
                {
                  type: "text",
                  text: "12345",
                },
                {
                  type: "text",
                  text: "June 16, 2026",
                },
              ],
            },
          ],
        },
      }),
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      console.error("ERROR WHATSAPP API:", JSON.stringify(data, null, 2));

      return NextResponse.json(
        {
          error: "Error enviando mensaje por WhatsApp API.",
          detalle: data,
        },
        { status: respuesta.status }
      );
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Mensaje enviado correctamente por WhatsApp API.",
      data,
    });
  } catch (error) {
    console.error("ERROR INTERNO WHATSAPP:", error);

    return NextResponse.json(
      {
        error: "Error interno enviando WhatsApp.",
        detalle: String(error),
      },
      { status: 500 }
    );
  }
}