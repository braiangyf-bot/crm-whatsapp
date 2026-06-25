"use client";

import { useState } from "react";

export default function EliminarCliente({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const [eliminando, setEliminando] = useState(false);

  async function eliminar() {
    const confirmar = confirm(
      `¿Seguro que deseas eliminar a ${nombre}? Esta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    setEliminando(true);

    await fetch("/api/clientes", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    window.location.reload();
  }

  return (
    <button
      onClick={eliminar}
      disabled={eliminando}
      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
    >
      {eliminando ? "Eliminando..." : "Eliminar"}
    </button>
  );
}