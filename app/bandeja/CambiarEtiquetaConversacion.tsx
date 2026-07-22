"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type EtiquetaComercial =
  | ""
  | "pendiente"
  | "contactado"
  | "interesado"
  | "cliente"
  | "no_responde";

type CambiarEtiquetaConversacionProps = {
  conversacionId: string;
  etiquetaActual: EtiquetaComercial;
};

const opciones: {
  valor: EtiquetaComercial;
  texto: string;
}[] = [
  {
    valor: "",
    texto: "Sin etiqueta",
  },
  {
    valor: "pendiente",
    texto: "Pendiente",
  },
  {
    valor: "contactado",
    texto: "Contactado",
  },
  {
    valor: "interesado",
    texto: "Interesado",
  },
  {
    valor: "cliente",
    texto: "Cliente",
  },
  {
    valor: "no_responde",
    texto: "No responde",
  },
];

export default function CambiarEtiquetaConversacion({
  conversacionId,
  etiquetaActual,
}: CambiarEtiquetaConversacionProps) {
  const router = useRouter();
  const [etiqueta, setEtiqueta] =
    useState<EtiquetaComercial>(etiquetaActual);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function cambiarEtiqueta(nuevaEtiqueta: EtiquetaComercial) {
    setEtiqueta(nuevaEtiqueta);
    setError(null);
    setGuardado(false);

    const respuesta = await fetch("/api/whatsapp/conversacion/etiqueta", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversacion_id: conversacionId,
        etiqueta: nuevaEtiqueta,
      }),
    });

    const data = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      setEtiqueta(etiquetaActual);
      setError(data?.error || "No se pudo guardar el estado comercial.");
      return;
    }

    setGuardado(true);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={etiqueta}
        onChange={(event) =>
          cambiarEtiqueta(event.target.value as EtiquetaComercial)
        }
        disabled={isPending}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor || "sin_etiqueta"} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>

      {guardado ? (
        <span className="text-[11px] font-semibold text-emerald-700">
          Estado comercial guardado
        </span>
      ) : null}

      {error ? (
        <span className="text-[11px] font-semibold text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}