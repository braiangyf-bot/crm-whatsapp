"use client";

import { useState } from "react";

type EstadoConversacion = "abierta" | "cerrada" | "archivada";

type Props = {
  conversacionId: string;
  estadoActual: EstadoConversacion;
};

export default function CambiarEstadoRapido({
  conversacionId,
  estadoActual,
}: Props) {
  const [cargando, setCargando] = useState<EstadoConversacion | null>(null);
  const [error, setError] = useState("");

  async function cambiarEstado(estado: EstadoConversacion) {
  const requiereConfirmacion =
    estado === "cerrada" || estado === "archivada";

  if (requiereConfirmacion) {
    const accion = estado === "cerrada" ? "cerrar" : "archivar";

    const confirmado = window.confirm(
      `¿Seguro que deseas ${accion} esta conversación?`
    );

    if (!confirmado) {
      return;
    }
  }

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
      throw new Error(datos?.error || "No se pudo cambiar el estado.");
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {estadoActual !== "abierta" ? (
          <button
            type="button"
            onClick={() => cambiarEstado("abierta")}
            disabled={cargando !== null}
            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            {cargando === "abierta" ? "Reabriendo..." : "Reabrir"}
          </button>
        ) : null}

        {estadoActual !== "cerrada" ? (
          <button
            type="button"
            onClick={() => cambiarEstado("cerrada")}
            disabled={cargando !== null}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {cargando === "cerrada" ? "Cerrando..." : "Cerrar"}
          </button>
        ) : null}

        {estadoActual !== "archivada" ? (
          <button
            type="button"
            onClick={() => cambiarEstado("archivada")}
            disabled={cargando !== null}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
          >
            {cargando === "archivada" ? "Archivando..." : "Archivar"}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}