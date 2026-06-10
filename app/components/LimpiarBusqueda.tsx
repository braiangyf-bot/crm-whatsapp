"use client";

export default function LimpiarBusqueda() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/";
      }}
      className="bg-gray-200 px-4 py-3 rounded"
    >
      Actualizar
    </button>
  );
}