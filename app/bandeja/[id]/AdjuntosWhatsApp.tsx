"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AdjuntosWhatsAppProps = {
  conversacionId: string;
  ventanaActiva: boolean;
};

function formatoTamano(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdjuntosWhatsApp({
  conversacionId,
  ventanaActiva,
}: AdjuntosWhatsAppProps) {
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeEnviar =
    ventanaActiva && archivo !== null && !enviando && !grabando;

  function limpiarSeleccion() {
    setArchivo(null);
    setCaption("");
    setError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function enviarArchivo() {
    if (!archivo || !puedeEnviar) {
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("conversacion_id", conversacionId);
      formData.append("archivo", archivo);
      formData.append("caption", caption);

      const respuesta = await fetch("/api/whatsapp/responder/media", {
        method: "POST",
        body: formData,
      });

      const data = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          data?.error || data?.mensaje || "No se pudo enviar el archivo",
        );
      }

      limpiarSeleccion();
      router.refresh();
    } catch (error) {
      console.error("Error enviando archivo:", error);

      setError(
        error instanceof Error ? error.message : "No se pudo enviar el archivo",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function iniciarGrabacion() {
    if (!ventanaActiva || grabando) {
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const tiposPreferidos = [
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/mpeg",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];

      const mimeTypeSoportado =
        tiposPreferidos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ||
        "";

      const recorder = mimeTypeSoportado
        ? new MediaRecorder(stream, { mimeType: mimeTypeSoportado })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (evento) => {
        if (evento.data.size > 0) {
          chunksRef.current.push(evento.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";

        const blob = new Blob(chunksRef.current, {
          type: mimeType,
        });

        const extension = mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
            ? "m4a"
            : mimeType.includes("mpeg")
              ? "mp3"
              : "webm";

        const audioFile = new File([blob], `audio-${Date.now()}.${extension}`, {
          type: mimeType,
        });

        setArchivo(audioFile);

        streamRef.current?.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
        mediaRecorderRef.current = null;
        chunksRef.current = [];
      };

      recorder.start();
      setGrabando(true);
    } catch (error) {
      console.error("No se pudo iniciar grabación:", error);

      setError(
        "No se pudo usar el micrófono. Revisa los permisos del navegador.",
      );
    }
  }

  function detenerGrabacion() {
    if (!mediaRecorderRef.current || !grabando) {
      return;
    }

    mediaRecorderRef.current.stop();
    setGrabando(false);
  }

  if (!ventanaActiva) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(evento) => {
            const seleccionado = evento.target.files?.[0] ?? null;
            setArchivo(seleccionado);
            setError(null);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          📎 Adjuntar archivo
        </button>

        {!grabando ? (
          <button
            type="button"
            onClick={iniciarGrabacion}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            🎙️ Grabar audio
          </button>
        ) : (
          <button
            type="button"
            onClick={detenerGrabacion}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            ⏹️ Detener grabación
          </button>
        )}
      </div>

      {archivo ? (
        <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">{archivo.name}</p>

              <p className="text-xs text-slate-500">
                {archivo.type || "Archivo"} · {formatoTamano(archivo.size)}
              </p>
              {archivo.type.includes("webm") ? (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  Este navegador grabó el audio en formato WEBM. WhatsApp puede
                  rechazarlo como nota de voz. Si falla, adjunta un audio MP3,
                  M4A u OGG.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={limpiarSeleccion}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Quitar
            </button>
          </div>

          {archivo.type.startsWith("image/") ? (
            <img
              src={URL.createObjectURL(archivo)}
              alt="Vista previa"
              className="mt-3 max-h-60 max-w-full rounded-xl border object-contain"
            />
          ) : null}

          {archivo.type.startsWith("audio/") ? (
            <audio
              controls
              src={URL.createObjectURL(archivo)}
              className="mt-3 w-full"
            />
          ) : null}

          {archivo.type.startsWith("video/") ? (
            <video
              controls
              src={URL.createObjectURL(archivo)}
              className="mt-3 max-h-60 max-w-full rounded-xl border"
            />
          ) : null}

          {!archivo.type.startsWith("audio/") ? (
            <textarea
              value={caption}
              onChange={(evento) => setCaption(evento.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Mensaje opcional para acompañar el archivo..."
              className="mt-3 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          ) : null}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={enviarArchivo}
              disabled={!puedeEnviar}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {enviando ? "Enviando..." : "Enviar archivo"}
            </button>
          </div>
        </div>
      ) : null}

      {grabando ? (
        <p className="mt-3 text-sm font-semibold text-red-700">
          Grabando audio...
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Nota: si un audio grabado desde el navegador no es aceptado por Meta,
        envíalo como archivo de audio desde el botón adjuntar.
      </p>
    </div>
  );
}
