"use client";

import { useState } from "react";

type ContenidoMensajeWhatsAppProps = {
    tipo: string | null;
    texto: string | null;
    mediaId: string | null;
    mimeType?: string | null;
    nombreArchivo?: string | null;
};

export default function ContenidoMensajeWhatsApp({
    tipo,
    texto,
    mediaId,
    mimeType,
    nombreArchivo,
}: ContenidoMensajeWhatsAppProps) {
    const [imagenAbierta, setImagenAbierta] = useState(false);
    const mediaUrl = mediaId
        ? `/api/whatsapp/media/${encodeURIComponent(mediaId)}`
        : null;

    if (tipo === "image" && mediaUrl) {
        return (
            <>
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => setImagenAbierta(true)}
                        className="block cursor-zoom-in"
                        title="Ampliar imagen"
                    >
                        <img
                            src={mediaUrl}
                            alt={nombreArchivo || "Imagen recibida por WhatsApp"}
                            className="max-h-80 max-w-[280px] rounded-xl border border-gray-200 object-contain transition hover:opacity-90"
                        />
                    </button>

                    {texto ? (
                        <p className="whitespace-pre-wrap text-sm text-gray-800">{texto}</p>
                    ) : null}
                </div>

                {imagenAbierta ? (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                        onClick={() => setImagenAbierta(false)}
                    >
                        <button
                            type="button"
                            onClick={() => setImagenAbierta(false)}
                            className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-lg font-bold text-slate-900 shadow"
                            aria-label="Cerrar imagen"
                        >
                            ×
                        </button>

                        <img
                            src={mediaUrl}
                            alt={nombreArchivo || "Imagen ampliada"}
                            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
                            onClick={(evento) => evento.stopPropagation()}
                        />
                    </div>
                ) : null}
            </>
        );
    }

    if (tipo === "audio" && mediaUrl) {
        return (
            <div className="w-[260px] max-w-full space-y-2">
                <audio controls className="w-full">
                    <source src={mediaUrl} type={mimeType || "audio/ogg"} />
                    Tu navegador no puede reproducir este audio.
                </audio>

                <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-blue-600 hover:underline"
                >
                    Abrir audio
                </a>
            </div>
        );
    }

    if (tipo === "video" && mediaUrl) {
        return (
            <div className="space-y-2">
                <video
                    controls
                    className="max-h-96 w-[320px] max-w-full rounded-xl border border-gray-200"
                >
                    <source src={mediaUrl} type={mimeType || "video/mp4"} />
                    Tu navegador no puede reproducir este video.
                </video>

                {texto ? (
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{texto}</p>
                ) : null}
            </div>
        );
    }

    if (tipo === "document" && mediaUrl) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-sm font-semibold text-gray-800">
                    Documento recibido
                </p>

                <p className="mt-1 text-xs text-gray-500">
                    {nombreArchivo || mimeType || "Archivo adjunto"}
                </p>

                <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                >
                    Abrir documento
                </a>
            </div>
        );
    }

    if (tipo === "sticker" && mediaUrl) {
        return (
            <img
                src={mediaUrl}
                alt="Sticker recibido por WhatsApp"
                className="max-h-40 max-w-40 object-contain"
            />
        );
    }

    if (texto) {
        return <p className="whitespace-pre-wrap text-sm">{texto}</p>;
    }

    return (
        <p className="text-sm italic text-gray-500">
            Mensaje recibido sin contenido visible.
        </p>
    );
}