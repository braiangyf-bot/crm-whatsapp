import { NextRequest, NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import path from "path";
import { readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import sharp from "sharp";

export const runtime = "nodejs";

type TipoMediaWhatsApp = "image" | "audio" | "video" | "document";

function normalizarTelefonoColombia(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, "");

  if (digitos.length === 10 && digitos.startsWith("3")) {
    return `57${digitos}`;
  }

  if (digitos.length === 12 && digitos.startsWith("57")) {
    return digitos;
  }

  return null;
}

function resolverTipoMedia(mimeType: string): TipoMediaWhatsApp {
  const tipoLimpio = mimeType.toLowerCase().split(";")[0].trim();

  if (tipoLimpio.startsWith("image/")) {
    return "image";
  }

  if (
    tipoLimpio === "audio/ogg" ||
    tipoLimpio === "audio/mpeg" ||
    tipoLimpio === "audio/mp3" ||
    tipoLimpio === "audio/mp4" ||
    tipoLimpio === "audio/amr" ||
    tipoLimpio === "audio/aac" ||
    tipoLimpio === "audio/x-m4a" ||
    tipoLimpio === "audio/m4a"
  ) {
    return "audio";
  }

  if (tipoLimpio.startsWith("audio/")) {
    return "audio";
  }

  if (tipoLimpio.startsWith("video/")) {
    return "video";
  }

  return "document";
}

function textoResumenTipo(
  tipo: TipoMediaWhatsApp,
  nombreArchivo: string,
): string {
  const nombres: Record<TipoMediaWhatsApp, string> = {
    image: "Imagen enviada",
    audio: "Nota de voz enviada",
    video: "Video enviado",
    document: "Documento enviado",
  };

  return nombreArchivo ? `${nombres[tipo]}: ${nombreArchivo}` : nombres[tipo];
}

function obtenerRutaFfmpeg(): string {
  const rutas = [
    typeof ffmpegPath === "string" ? ffmpegPath : "",
    path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    ),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
  ];

  const rutaEncontrada = rutas.find((ruta) => ruta && existsSync(ruta));

  if (!rutaEncontrada) {
    throw new Error(
      `No se encontró FFmpeg. Rutas probadas: ${rutas.filter(Boolean).join(" | ")}`,
    );
  }

  return rutaEncontrada;
}

function ejecutarFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let rutaFfmpeg: string;

    try {
      rutaFfmpeg = obtenerRutaFfmpeg();
    } catch (error) {
      reject(error);
      return;
    }

    console.log("Usando FFmpeg:", rutaFfmpeg);

    const proceso = spawn(rutaFfmpeg, args, {
      windowsHide: true,
    });

    let errorSalida = "";

    proceso.stderr.on("data", (data) => {
      errorSalida += data.toString();
    });

    proceso.on("error", (error) => {
      reject(error);
    });

    proceso.on("close", (codigo) => {
      if (codigo === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFmpeg falló convirtiendo audio: ${errorSalida.slice(-1200)}`,
        ),
      );
    });
  });
}

async function convertirAudioAOggOpus(archivo: File): Promise<{
  blob: Blob;
  nombreArchivo: string;
  mimeType: string;
}> {
  const id = randomUUID();
  const nombreEntrada = archivo.name || "audio.webm";
  const entrada = path.join(tmpdir(), `${id}-${nombreEntrada}`);
  const salida = path.join(tmpdir(), `${id}.ogg`);

  const bufferEntrada = Buffer.from(await archivo.arrayBuffer());

  await writeFile(entrada, bufferEntrada);

  try {
    await ejecutarFfmpeg([
      "-y",
      "-i",
      entrada,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-c:a",
      "libopus",
      "-b:a",
      "24k",
      "-vbr",
      "on",
      "-compression_level",
      "10",
      "-application",
      "voip",
      "-f",
      "ogg",
      salida,
    ]);

    const bufferSalida = await readFile(salida);
    const firmaArchivo = bufferSalida.subarray(0, 4).toString("utf8");
    const nombreConvertido = `voice-note-${Date.now()}.ogg`;

    const contieneOpusHead = bufferSalida.includes(Buffer.from("OpusHead"));

    console.log("Audio convertido por FFmpeg:", {
      bytes: bufferSalida.length,
      firma: firmaArchivo,
      contieneOpusHead,
      primerosBytesHex: bufferSalida.subarray(0, 32).toString("hex"),
    });

    if (firmaArchivo !== "OggS") {
      throw new Error(
        `FFmpeg no generó un OGG válido. Firma detectada: ${firmaArchivo || "vacía"}`
      );
    }
    if (!contieneOpusHead) {
      throw new Error("FFmpeg generó OGG, pero no contiene cabecera OpusHead.");
    }

    return {
      blob: new File([new Uint8Array(bufferSalida)], nombreConvertido, {
        type: "audio/ogg",
      }),
      nombreArchivo: nombreConvertido,
      mimeType: "audio/ogg",
    };
  } finally {
    await Promise.allSettled([unlink(entrada), unlink(salida)]);
  }
}
async function normalizarImagenAntesDeSubir(archivo: File): Promise<{
  blob: Blob;
  nombreArchivo: string;
  mimeType: string;
}> {
  const bufferEntrada = Buffer.from(await archivo.arrayBuffer());

  const bufferSalida = await sharp(bufferEntrada)
    .rotate()
    .jpeg({
      quality: 90,
      mozjpeg: true,
    })
    .toBuffer();

  const nombreBase =
    archivo.name
      ?.replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 80) || "imagen";

  const nombreArchivo = `${nombreBase}-${Date.now()}.jpg`;

  return {
    blob: new Blob([new Uint8Array(bufferSalida)], {
      type: "image/jpeg",
    }),
    nombreArchivo,
    mimeType: "image/jpeg",
  };
}

export async function POST(request: NextRequest) {
  console.log("API media recibió petición");

  try {
    await exigirUsuarioApi();

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";

    if (!token || !phoneNumberId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan variables de WhatsApp en el servidor",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();

    const conversacionId = String(formData.get("conversacion_id") || "");
    const caption = String(formData.get("caption") || "").trim();
    const archivo = formData.get("archivo");
    const esNotaVozSolicitada =
      String(formData.get("es_nota_voz") || "") === "true";

    if (!conversacionId) {
      return NextResponse.json(
        { ok: false, error: "Falta conversacion_id" },
        { status: 400 },
      );
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Falta archivo" },
        { status: 400 },
      );
    }

    if (archivo.size <= 0) {
      return NextResponse.json(
        { ok: false, error: "El archivo está vacío" },
        { status: 400 },
      );
    }

    const limiteBytes = 15 * 1024 * 1024;

    if (archivo.size > limiteBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: "El archivo supera el límite interno de 15 MB",
        },
        { status: 400 },
      );
    }

    const conversacion = await prisma.conversaciones_whatsapp.findUnique({
      where: {
        id: conversacionId,
      },
      select: {
        id: true,
        telefono_cliente: true,
        estado: true,
        ventana_atencion_hasta: true,
      },
    });

    if (!conversacion) {
      return NextResponse.json(
        { ok: false, error: "Conversación no encontrada" },
        { status: 404 },
      );
    }

    if (conversacion.estado !== "abierta") {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no está abierta",
        },
        { status: 400 },
      );
    }

    if (
      !conversacion.ventana_atencion_hasta ||
      conversacion.ventana_atencion_hasta <= new Date()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La ventana de 24 horas está cerrada. Usa una plantilla oficial.",
        },
        { status: 400 },
      );
    }

    const telefonoDestino = normalizarTelefonoColombia(
      conversacion.telefono_cliente,
    );

    if (!telefonoDestino) {
      return NextResponse.json(
        {
          ok: false,
          error: "El teléfono del cliente no tiene formato válido",
        },
        { status: 400 },
      );
    }

    let nombreArchivo = archivo.name || "archivo";
    let mimeType = archivo.type || "application/octet-stream";
    let archivoParaSubir: Blob = archivo;
    let tipo = resolverTipoMedia(mimeType);
    if (tipo === "image") {
      console.log("Normalizando orientación de imagen antes de subir...");

      const imagenNormalizada = await normalizarImagenAntesDeSubir(archivo);

      archivoParaSubir = imagenNormalizada.blob;
      nombreArchivo = imagenNormalizada.nombreArchivo;
      mimeType = imagenNormalizada.mimeType;
      tipo = "image";

      console.log("Imagen normalizada:", {
        nombreArchivo,
        mimeType,
        tamanoOriginal: archivo.size,
        tamanoNormalizado: archivoParaSubir.size,
      });
    }

    const pareceGrabacionDelNavegador = /^audio-\d+\.(webm|m4a|ogg|mp3)$/i.test(
      nombreArchivo,
    );

    let enviarComoNotaVoz =
      esNotaVozSolicitada || pareceGrabacionDelNavegador;

    if (enviarComoNotaVoz && mimeType.toLowerCase().startsWith("audio/")) {
      console.log("Convirtiendo audio a OGG Opus para nota de voz...");

      const convertido = await convertirAudioAOggOpus(archivo);

      archivoParaSubir = convertido.blob;
      nombreArchivo = convertido.nombreArchivo;
      mimeType = convertido.mimeType;
      tipo = "audio";
      enviarComoNotaVoz = true;
    }

    const bufferParaSubir = Buffer.from(await archivoParaSubir.arrayBuffer());
    const boundary = `----crm-whatsapp-${randomUUID()}`;
    const mimeParaSubir =
      tipo === "audio" && enviarComoNotaVoz
        ? "audio/ogg; codecs=opus"
        : mimeType;

    const cabeceraMultipart = Buffer.from(
      [
        `--${boundary}`,
        `Content-Disposition: form-data; name="messaging_product"`,
        "",
        "whatsapp",
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${nombreArchivo.replace(/"/g, "")}"`,
        `Content-Type: ${mimeParaSubir}`,
        "",
      ].join("\r\n") + "\r\n",
    );

    const cierreMultipart = Buffer.from(`\r\n--${boundary}--\r\n`);

    const cuerpoMultipart = Buffer.concat([
      cabeceraMultipart,
      bufferParaSubir,
      cierreMultipart,
    ]);

    console.log("Intentando subir media a Meta:", {
      nombreArchivo,
      tipoArchivo: mimeType,
      mimeParaSubir,
      mimeSubido: archivoParaSubir.type,
      tamanoOriginal: archivo.size,
      tamanoSubido: archivoParaSubir.size,
      tamanoBufferSubido: bufferParaSubir.length,
      firmaSubida: bufferParaSubir.subarray(0, 4).toString("utf8"),
      contieneOpusHeadSubida: bufferParaSubir.includes(Buffer.from("OpusHead")),
      phoneNumberId,
      apiVersion,
      enviarComoNotaVoz,
    });

    const uploadResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(cuerpoMultipart.length),
        },
        body: cuerpoMultipart,
      },
    );
    const uploadData = await uploadResponse.json().catch(() => null);

    if (!uploadResponse.ok || !uploadData?.id) {
      console.error("Meta rechazó subida de media:", {
        status: uploadResponse.status,
        tipoArchivo: mimeType,
        nombreArchivo,
        tamano: archivo.size,
        respuestaMeta: uploadData,
      });

      const mensajeMeta =
        uploadData?.error?.message ||
        uploadData?.error?.error_user_msg ||
        uploadData?.message ||
        JSON.stringify(uploadData);

      return NextResponse.json(
        {
          ok: false,
          error: `Meta no aceptó la subida del archivo: ${mensajeMeta}`,
          detalle: uploadData,
        },
        { status: uploadResponse.status || 400 },
      );
    }

    const mediaId = String(uploadData.id);

    if (enviarComoNotaVoz) {
      tipo = "audio";
    }

    const mediaObject: Record<string, string | boolean> = {
      id: mediaId,
    };

    if (tipo === "audio" && enviarComoNotaVoz) {
      mediaObject.voice = true;
    }

    if (
      (tipo === "image" || tipo === "video" || tipo === "document") &&
      caption
    ) {
      mediaObject.caption = caption;
    }

    if (tipo === "document") {
      mediaObject.filename = nombreArchivo;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: telefonoDestino,
      type: tipo,
      [tipo]: mediaObject,
    };

    console.log("Payload final para Meta:", JSON.stringify(payload, null, 2));

    const sendResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const sendData = await sendResponse.json().catch(() => null);

    console.log("Respuesta de Meta al enviar media:", {
      status: sendResponse.status,
      ok: sendResponse.ok,
      sendData,
    });

    const whatsappMessageId = sendData?.messages?.[0]?.id ?? null;

    const ahora = new Date();
    const contenido = caption || textoResumenTipo(tipo, nombreArchivo);

    await prisma.mensajes_whatsapp.create({
      data: {
        conversacion_id: conversacion.id,
        direccion: "saliente",
        tipo,
        contenido,
        caption: caption || null,
        media_id: mediaId,
        mime_type: mimeType,
        nombre_archivo: nombreArchivo,
        whatsapp_message_id: whatsappMessageId,
        estado_api: sendResponse.ok ? "accepted" : "failed",
        fecha_mensaje: ahora,
      },
    });

    await prisma.conversaciones_whatsapp.update({
      where: {
        id: conversacion.id,
      },
      data: {
        ultimo_mensaje: contenido,
        fecha_ultimo_mensaje: ahora,
      },
    });

    if (!sendResponse.ok) {
      console.error("Meta rechazó envío de mensaje media:", {
        status: sendResponse.status,
        payload,
        respuestaMeta: sendData,
      });

      const mensajeMeta =
        sendData?.error?.message ||
        sendData?.error?.error_user_msg ||
        sendData?.message ||
        JSON.stringify(sendData);

      return NextResponse.json(
        {
          ok: false,
          error: `El archivo se subió, pero Meta no envió el mensaje: ${mensajeMeta}`,
          detalle: sendData,
        },
        { status: sendResponse.status || 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      media_id: mediaId,
      whatsapp_message_id: whatsappMessageId,
      tipo,
      nota_voz: enviarComoNotaVoz,
    });
  } catch (error) {
    console.error("Error enviando media por WhatsApp:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno enviando multimedia",
      },
      { status: 500 },
    );
  }
}
