"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ClienteNotasProps = {
    clienteId: string;
    notasIniciales: string | null;
};

export default function ClienteNotas({
    clienteId,
    notasIniciales,
}: ClienteNotasProps) {
    const router = useRouter();
    const [notas, setNotas] = useState(notasIniciales ?? "");
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    async function guardarNotas() {
        setMensaje(null);

        const respuesta = await fetch("/api/clientes/notas", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: clienteId,
                notas,
            }),
        });

        const data = await respuesta.json().catch(() => null);

        if (!respuesta.ok) {
            setMensaje(data?.error || "No se pudieron guardar las notas.");
            return;
        }

        setMensaje("Notas guardadas correctamente.");

        startTransition(() => {
            router.refresh();
        });
    }

    return (
        <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">
                    NOTAS INTERNAS
                </p>

                {mensaje && (
                    <span className="text-xs font-semibold text-emerald-700">
                        {mensaje}
                    </span>
                )}
            </div>

            <textarea
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                rows={5}
                placeholder="Ej: Cliente interesado en producto para gastritis. Volver a contactar el viernes."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-2 flex justify-end">
                <button
                    type="button"
                    onClick={guardarNotas}
                    disabled={isPending}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isPending ? "Guardando..." : "Guardar notas"}
                </button>
            </div>
        </div>
    );
}