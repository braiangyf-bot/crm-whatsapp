"use client";

import { useState } from "react";

type Props = {
  clienteId: string;
  notaActual: string | null;
};

export default function NotasCliente({ clienteId, notaActual }: Props) {
  const [nota, setNota] = useState(notaActual || "");
  const [notaGuardada, setNotaGuardada] = useState(notaActual || "");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardarNota() {
    setGuardando(true);

    try {
      const res = await fetch("/api/clientes/notas", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: clienteId,
          notas: nota,
        }),
      });

      if (!res.ok) {
        throw new Error("Error guardando nota");
      }

      setNotaGuardada(nota);
      setAbierto(false);
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar la nota");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1 max-w-xs">
        <p className="text-sm text-gray-700 truncate">
          {notaGuardada ? notaGuardada : "Sin notas"}
        </p>

        <button
          type="button"
          onClick={() => {
            setNota(notaGuardada);
            setAbierto(true);
          }}
          className="text-blue-600 text-sm text-left hover:underline"
        >
          Ver / Editar seguimiento
        </button>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Seguimiento del cliente
            </h2>

            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="min-h-40 w-full rounded border border-gray-300 p-3 text-sm outline-none focus:border-blue-500"
              placeholder="Escribe aquí las observaciones, seguimiento, interés del cliente o detalles importantes..."
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNota(notaGuardada);
                  setAbierto(false);
                }}
                className="rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={guardarNota}
                disabled={guardando}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}