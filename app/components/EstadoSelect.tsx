"use client";

import { useState } from "react";

type Props = {
  clienteId: string;
  estadoActual: string;
};

export default function EstadoSelect({ clienteId, estadoActual }: Props) {
  const [estado, setEstado] = useState(estadoActual);
  const [guardando, setGuardando] = useState(false);

  const colorEstado =
    estado === "pendiente"
      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
      : estado === "contactado"
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : estado === "interesado"
      ? "bg-green-100 text-green-800 border-green-300"
      : estado === "cliente"
      ? "bg-purple-100 text-purple-800 border-purple-300"
      : "bg-red-100 text-red-800 border-red-300";

  async function cambiarEstado(nuevoEstado: string) {
    const estadoAnterior = estado;

    setEstado(nuevoEstado);
    setGuardando(true);

    try {
      const respuesta = await fetch("/api/clientes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clienteId, estado: nuevoEstado }),
      });

      if (!respuesta.ok) {
        setEstado(estadoAnterior);
        alert("No se pudo actualizar el estado");
      }
    } catch (error) {
      setEstado(estadoAnterior);
      alert("Error de conexión al actualizar el estado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <select
      value={estado}
      disabled={guardando}
      onChange={(e) => cambiarEstado(e.target.value)}
      className={`border px-3 py-2 rounded font-semibold ${colorEstado}`}
    >
      <option value="pendiente">Pendiente</option>
      <option value="contactado">Contactado</option>
      <option value="interesado">Interesado</option>
      <option value="cliente">Cliente</option>
      <option value="no_responde">No responde</option>
    </select>
  );
}