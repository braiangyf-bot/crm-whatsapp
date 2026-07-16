import { NextRequest, NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    mediaId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await exigirUsuarioApi();

    const { mediaId } = await params;

    if (!mediaId) {
      return NextResponse.json(
        { ok: false, error: "Falta mediaId" },
        { status: 400 }
      );
    }

    const token = process.env.WHATSAPP_TOKEN;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Falta WHATSAPP_TOKEN" },
        { status: 500 }
      );
    }

    const infoResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!infoResponse.ok) {
      const errorText = await infoResponse.text();

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo obtener la URL del archivo",
          detalle: errorText,
        },
        { status: infoResponse.status }
      );
    }

    const mediaInfo = (await infoResponse.json()) as {
      url?: string;
      mime_type?: string;
    };

    if (!mediaInfo.url) {
      return NextResponse.json(
        { ok: false, error: "Meta no devolvió URL del archivo" },
        { status: 404 }
      );
    }

    const fileResponse = await fetch(mediaInfo.url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo descargar el archivo",
          detalle: errorText,
        },
        { status: fileResponse.status }
      );
    }

    const contentType =
      fileResponse.headers.get("content-type") ||
      mediaInfo.mime_type ||
      "application/octet-stream";

    const buffer = await fileResponse.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error obteniendo media de WhatsApp:", error);

    return NextResponse.json(
      { ok: false, error: "Error interno obteniendo archivo" },
      { status: 500 }
    );
  }
}