"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import AdjuntosWhatsApp from "./AdjuntosWhatsApp";

type ResponderLibreProps = {
  conversacionId: string;
  ventanaActiva: boolean;
};

const EMOJIS = [
  "😀",
  "😊",
  "🙏",
  "👍",
  "🙌",
  "❤️",
  "💚",
  "🌿",
  "📦",
  "🚚",
  "✅",
  "☑️",
  "📞",
  "💬",
  "🔥",
  "⭐",
  "🎉",
  "😃",
  "😉",
  "🤝",
];

const RESPUESTAS_RAPIDAS = [
  "Hola, ¿cómo estás? 😊",
  "Claro, con mucho gusto te ayudo.",
  "¿Me confirmas por favor tu nombre y dirección?",
  "Nuestro horario de atención es de lunes a viernes de 8:00 a.m. a 5:00 p.m.",
  "Manejamos pago contraentrega en Medellín y área metropolitana.",
  "Gracias por escribirnos. Ya reviso tu caso.",
];

export default function ResponderLibre({
  conversacionId,
  ventanaActiva,
}: ResponderLibreProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const [mostrarRapidas, setMostrarRapidas] = useState(false);

  const mensajeLimpio = mensaje.trim();
  const puedeEnviar = ventanaActiva && mensajeLimpio.length > 0 && !enviando;

  function crearIdempotencyKey() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function insertarTexto(texto: string) {
    const textarea = textareaRef.current;

    if (!textarea) {
      setMensaje((actual) => `${actual}${texto}`);
      return;
    }

    const inicio = textarea.selectionStart;
    const fin = textarea.selectionEnd;
    const antes = mensaje.slice(0, inicio);
    const despues = mensaje.slice(fin);
    const nuevoMensaje = `${antes}${texto}${despues}`;

    setMensaje(nuevoMensaje);

    window.setTimeout(() => {
      textarea.focus();
      const nuevaPosicion = inicio + texto.length;
      textarea.setSelectionRange(nuevaPosicion, nuevaPosicion);
    }, 0);
  }

  function usarRespuestaRapida(texto: string) {
    setMensaje(texto);
    setMostrarRapidas(false);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }

  async function enviarMensaje() {
    if (!puedeEnviar) {
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const respuesta = await fetch("/api/whatsapp/responder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversacion_id: conversacionId,
          conversacionId,
          mensaje: mensajeLimpio,
          texto: mensajeLimpio,
          contenido: mensajeLimpio,
          idempotency_key: crearIdempotencyKey(),
        }),
      });

      const data = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
          data?.mensaje ||
          "No se pudo enviar el mensaje",
        );
      }

      setMensaje("");
      setMostrarEmojis(false);
      setMostrarRapidas(false);
      router.refresh();
    } catch (error) {
      console.error("Error enviando respuesta:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el mensaje",
      );
    } finally {
      setEnviando(false);
    }
  }

  function manejarTeclado(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviarMensaje();
    }
  }

  if (!ventanaActiva) {
    return (
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">
          No puedes responder con mensaje libre porque la ventana de 24
          horas está cerrada.
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Para escribirle de nuevo al cliente, debes usar una plantilla
          oficial aprobada por Meta.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Responder por WhatsApp
          </h2>

          <p className="text-xs text-slate-500">
            Enter envía · Shift + Enter agrega salto de línea
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMostrarEmojis((actual) => !actual);
              setMostrarRapidas(false);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            😊 Emojis
          </button>

          <button
            type="button"
            onClick={() => {
              setMostrarRapidas((actual) => !actual);
              setMostrarEmojis(false);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ⚡ Respuestas rápidas
          </button>
        </div>
      </div>

      {mostrarEmojis ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertarTexto(emoji)}
                className="rounded-lg bg-white px-3 py-2 text-xl shadow-sm hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mostrarRapidas ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2">
            {RESPUESTAS_RAPIDAS.map((respuestaRapida) => (
              <button
                key={respuestaRapida}
                type="button"
                onClick={() =>
                  usarRespuestaRapida(respuestaRapida)
                }
                className="rounded-lg bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:bg-slate-100"
              >
                {respuestaRapida}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={mensaje}
        onChange={(evento) => setMensaje(evento.target.value)}
        onKeyDown={manejarTeclado}
        rows={4}
        maxLength={4000}
        placeholder="Escribe tu respuesta..."
        className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
   
      <AdjuntosWhatsApp
        conversacionId={conversacionId}
        ventanaActiva={ventanaActiva}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {mensaje.length}/4000 caracteres
        </p>

        <button
          type="button"
          onClick={enviarMensaje}
          disabled={!puedeEnviar}
          className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}