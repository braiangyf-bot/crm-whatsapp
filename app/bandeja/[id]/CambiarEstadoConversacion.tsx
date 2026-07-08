"use client";

import { useState } from "react";

type EstadoConversacion = "abierta" | "cerrada" | "archivada";

type Props = {
  conversacionId: string;
  estadoActual: EstadoConversacion;
};

export default function CambiarEstadoConversacion({
  conversacionId,
  estadoActual,
}: Props) {
  const [cargando, setCargando] = useState<EstadoConversacion | null>(null);
  const [error, setError] = useState("");

  async function cambiarEstado(estado: EstadoConversacion) {
    setCargando(estado);
    setError("");

    try {
      const respuesta = await fetch("/api/whatsapp/conversacion/estado", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversacion_id: conversacionId,
          estado,
        }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !datos?.ok) {
        throw new Error(
          datos?.error || "No se pudo cambiar el estado."
        );
      }

      window.location.reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado."
      );
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">
        Estado de la conversación
      </p>

      <p className="mt-1 text-sm text-slate-600">
        Estado actual:{" "}
        <span className="font-semibold text-slate-900">
          {estadoActual}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {estadoActual !== "abierta" ? (
          <button
            type="button"
            onClick={() => cambiarEstado("abierta")}
            disabled={cargando !== null}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {cargando === "abierta" ? "Reabriendo..." : "Reabrir"}
          </button>
        ) : null}

        {estadoActual !== "cerrada" ? (
          <button
            type="button"
            onClick={() => cambiarEstado("cerrada")}
            disabled={cargando !== null}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {cargando === "cerrada" ? "Cerrando..." : "Cerrar"}
          </button>
        ) : null}

        {estadoActual !== "archivada" ? (
          <button
            type="button"
            onClick={() => cambiarEstado("archivada")}
            disabled={cargando !== null}
            className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
          >
            {cargando === "archivada" ? "Archivando..." : "Archivar"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}