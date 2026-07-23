"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CrearClienteDesdeConversacionProps = {
  conversacionId: string;
  nombreInicial: string;
  telefono: string;
};

export default function CrearClienteDesdeConversacion({
  conversacionId,
  nombreInicial,
  telefono,
}: CrearClienteDesdeConversacionProps) {
  const router = useRouter();

  const [nombre, setNombre] = useState(nombreInicial);
  const [cedula, setCedula] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function crearCliente() {
    setGuardando(true);
    setMensaje(null);
    setError(null);

    try {
      const respuesta = await fetch(
        "/api/whatsapp/conversacion/crear-cliente",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversacion_id: conversacionId,
            nombre,
            cedula,
            estado,
            notas,
          }),
        },
      );

      const data = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        setError(data?.error || "No se pudo crear el cliente.");
        return;
      }

      setMensaje(
        data?.mensaje || "Cliente creado y vinculado correctamente.",
      );

      router.refresh();
    } catch (errorCrearCliente) {
      setError(
        errorCrearCliente instanceof Error
          ? errorCrearCliente.message
          : "No se pudo crear el cliente.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div>
        <h3 className="text-sm font-bold text-amber-950">
          Crear cliente desde esta conversación
        </h3>

        <p className="mt-1 text-sm text-amber-900">
          Este contacto aún no está vinculado al CRM. Puedes crearlo usando
          este WhatsApp.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Nombre
          </label>
          <input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Nombre del cliente"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Teléfono
          </label>
          <input
            value={telefono}
            disabled
            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Cédula
          </label>
          <input
            value={cedula}
            onChange={(event) =>
              setCedula(event.target.value.replace(/\D/g, ""))
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Opcional. Si la dejas vacía, se usa el teléfono."
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Estado inicial
          </label>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="pendiente">Pendiente</option>
            <option value="contactado">Contactado</option>
            <option value="interesado">Interesado</option>
            <option value="cliente">Cliente</option>
            <option value="no_responde">No responde</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Notas internas
          </label>
          <textarea
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Ej: Cliente escribió por WhatsApp preguntando por productos."
          />
        </div>
      </div>

      {mensaje ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          {mensaje}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={crearCliente}
          disabled={guardando}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Creando..." : "Crear cliente"}
        </button>
      </div>
    </div>
  );
}