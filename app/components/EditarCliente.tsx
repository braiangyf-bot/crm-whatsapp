"use client";

import { useState } from "react";

type Cliente = {
  id: string;
  created_at: Date;
  nombre: string;
  cedula: string;
  telefono: string;
  estado: string | null;
  ultimo_contacto: Date | null;
  notas: string | null;
};

export default function EditarCliente({ cliente }: { cliente: Cliente }) {
  const [abierto, setAbierto] = useState(false);
  const [cedula, setCedula] = useState(cliente.cedula);
  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(cliente.telefono);
  const [estado, setEstado] = useState(cliente.estado || "pendiente");
  const [notas, setNotas] = useState(cliente.notas || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cerrarModal() {
    setAbierto(false);
    setError("");
    setCedula(cliente.cedula);
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono);
    setEstado(cliente.estado || "pendiente");
    setNotas(cliente.notas || "");
  }

  async function guardarCambios() {
    setError("");

    const cedulaLimpia = cedula.trim().replace(/\D/g, "");
    const nombreLimpio = nombre.trim();
    const telefonoLimpio = telefono.trim().replace(/\D/g, "");

    if (!cedulaLimpia || !nombreLimpio || !telefonoLimpio) {
      setError("La cédula, el nombre y el teléfono son obligatorios.");
      return;
    }

    if (cedula !== cedulaLimpia || telefono !== telefonoLimpio) {
      setError("La cédula y el teléfono solo deben contener números.");
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await fetch("/api/clientes/editar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cliente.id,
          cedula: cedulaLimpia,
          nombre: nombreLimpio,
          telefono: telefonoLimpio,
          estado,
          notas: notas.trim(),
        }),
      });

      const texto = await respuesta.text();
      const resultado = texto ? JSON.parse(texto) : null;

      if (!respuesta.ok) {
        setError(
          resultado?.error ||
            "No se pudo actualizar el cliente. Intenta de nuevo."
        );
        return;
      }

      setAbierto(false);
      window.location.reload();
    } catch (error) {
      console.error("Error editando cliente:", error);
      setError("Ocurrió un error inesperado al editar el cliente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setAbierto(true)}
        className="rounded bg-gray-800 px-3 py-1 text-white"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold">Editar cliente</h2>

            {error && (
              <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <input
              className="mb-2 w-full rounded border p-2"
              value={cedula}
              onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
              placeholder="Cédula"
              inputMode="numeric"
              pattern="[0-9]+"
              title="La cédula solo debe contener números"
              required
            />

            <input
              className="mb-2 w-full rounded border p-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              required
            />

            <input
              className="mb-2 w-full rounded border p-2"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
              placeholder="Teléfono"
              inputMode="numeric"
              pattern="[0-9]+"
              title="El teléfono solo debe contener números"
              required
            />

            <select
              className="mb-2 w-full rounded border p-2"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="pendiente">Pendiente</option>
              <option value="contactado">Contactado</option>
              <option value="interesado">Interesado</option>
              <option value="cliente">Cliente</option>
              <option value="no_responde">No responde</option>
            </select>

            <textarea
              className="mb-4 w-full rounded border p-2"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas"
              rows={4}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={cerrarModal}
                disabled={guardando}
                className="rounded border px-4 py-2"
              >
                Cancelar
              </button>

              <button
                onClick={guardarCambios}
                disabled={guardando}
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}