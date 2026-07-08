"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type ResponderLibreProps = {
  conversacionId: string;
  ventanaActiva: boolean;
};

function crearIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ResponderLibre({
  conversacionId,
  ventanaActiva,
}: ResponderLibreProps) {
  const router = useRouter();

  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  async function enviarRespuesta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const texto = mensaje.trim();

    setError("");
    setExito("");

    if (!texto) {
      setError("Escribe un mensaje antes de enviar.");
      return;
    }

    if (!ventanaActiva) {
      setError(
        "La ventana de atención de 24 horas está cerrada. Para responder se debe usar una plantilla oficial.",
      );
      return;
    }

    setEnviando(true);

    try {
      const respuesta = await fetch("/api/whatsapp/responder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversacion_id: conversacionId,
          mensaje: texto,
          idempotency_key: crearIdempotencyKey(),
        }),
      });

      const data = await respuesta.json();

      if (!respuesta.ok || !data.ok) {
        setError(
          data.error ||
            "No se pudo enviar la respuesta por WhatsApp.",
        );
        return;
      }

      setMensaje("");
      setExito("Respuesta enviada correctamente.");
      router.refresh();
    } catch (errorDesconocido) {
      console.error(errorDesconocido);
      setError("Error de conexión al enviar la respuesta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Responder
      </h2>

      {!ventanaActiva && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          La ventana de atención de 24 horas está cerrada. En este caso
          WhatsApp exige responder con una plantilla oficial aprobada.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {exito && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          {exito}
        </div>
      )}

      <form onSubmit={enviarRespuesta} className="mt-4 space-y-3">
        <textarea
          value={mensaje}
          onChange={(event) => setMensaje(event.target.value)}
          disabled={!ventanaActiva || enviando}
          maxLength={4096}
          rows={4}
          placeholder={
            ventanaActiva
              ? "Escribe una respuesta para enviar por WhatsApp..."
              : "La ventana está cerrada. Usa una plantilla oficial."
          }
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {mensaje.length}/4096 caracteres
          </p>

          <button
            type="submit"
            disabled={!ventanaActiva || enviando}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {enviando ? "Enviando..." : "Enviar respuesta"}
          </button>
        </div>
      </form>

      <p className="mt-3 text-xs text-slate-500">
        Esta opción solo permite texto libre dentro de la ventana de
        atención de 24 horas.
      </p>
    </section>
  );
}
