"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EstadoSelect from "@/app/components/EstadoSelect";
import NotasCliente from "@/app/components/NotasCliente";
import EditarCliente from "@/app/components/EditarCliente";
import EliminarCliente from "@/app/components/EliminarCliente";
import BotonCampaña from "@/app/components/BotonCampaña";

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

type PlantillaMeta = {
name: string;
language: string;
status: string;
category: string;
bodyText: string;
variableCount: number;
};

type RespuestaCampana = {
enviadas?: number;
fallidas?: number;
error?: string;
lote?: {
total_enviadas?: number;
total_fallidas?: number;
};
};

export default function TablaClientes({
clientes,
}: {
clientes: Cliente[];
}) {
const router = useRouter();

const [seleccionados, setSeleccionados] = useState<string[]>([]);
const [plantillas, setPlantillas] = useState<PlantillaMeta[]>([]);

const [plantillaSeleccionada, setPlantillaSeleccionada] =
useState<PlantillaMeta | null>(null);

const [cargandoPlantillas, setCargandoPlantillas] =
useState(false);

const [enviando, setEnviando] = useState(false);
const [mensaje, setMensaje] = useState("");
const [error, setError] = useState("");
const [montado, setMontado] = useState(false);

const LIMITE_SELECCION = 50;

const idsPermitidos = clientes
.slice(0, LIMITE_SELECCION)
.map((cliente) => cliente.id);

const todosPermitidosSeleccionados =
idsPermitidos.length > 0 &&
idsPermitidos.every((id) =>
seleccionados.includes(id)
);

useEffect(() => {
setMontado(true);


async function cargarPlantillas() {
  try {
    setCargandoPlantillas(true);
    setError("");

    const respuesta = await fetch(
      "/api/whatsapp/plantillas",
      {
        cache: "no-store",
      }
    );

    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        data.error ||
          "No se pudieron cargar las plantillas."
      );
    }

    setPlantillas(data.plantillas || []);
  } catch (errorDesconocido) {
    const detalle =
      errorDesconocido instanceof Error
        ? errorDesconocido.message
        : String(errorDesconocido);

    setError(detalle);
  } finally {
    setCargandoPlantillas(false);
  }
}

cargarPlantillas();


}, []);

function formatearFecha(fecha: Date | null) {
if (!montado || !fecha) {
return "-";
}


return new Date(fecha).toLocaleString("es-CO", {
  timeZone: "America/Bogota",
});


}

function cambiarSeleccion(clienteId: string) {
setMensaje("");
setError("");

setSeleccionados((actuales) => {
  if (actuales.includes(clienteId)) {
    return actuales.filter(
      (id) => id !== clienteId
    );
  }

  if (
    actuales.length >=
    LIMITE_SELECCION
  ) {
    setError(
      `Por seguridad, selecciona máximo ${LIMITE_SELECCION} clientes visibles.`
    );

    return actuales;
  }

  return [...actuales, clienteId];
});


}

function toggleSeleccionarTodos() {
setMensaje("");
setError("");


if (todosPermitidosSeleccionados) {
  setSeleccionados([]);
  return;
}

setSeleccionados(idsPermitidos);

if (
  clientes.length >
  LIMITE_SELECCION
) {
  setError(
    `Solo se seleccionaron los primeros ${LIMITE_SELECCION} clientes visibles.`
  );
}


}

function seleccionarPagina() {
setMensaje("");
setError("");


if (seleccionados.length > 0) {
  setSeleccionados([]);
  return;
}

setSeleccionados(idsPermitidos);

if (
  clientes.length >
  LIMITE_SELECCION
) {
  setError(
    `Solo se seleccionaron los primeros ${LIMITE_SELECCION} clientes visibles.`
  );
}


}

async function enviarCampanaSeleccionados() {
try {
setMensaje("");
setError("");


  if (seleccionados.length === 0) {
    setError(
      "Selecciona al menos un cliente."
    );

    return;
  }

  if (
    seleccionados.length >
    LIMITE_SELECCION
  ) {
    setError(
      `Solo puedes enviar máximo ${LIMITE_SELECCION} clientes por campaña.`
    );

    return;
  }

  if (!plantillaSeleccionada) {
    setError(
      "Selecciona una plantilla aprobada de Meta."
    );

    return;
  }

  setEnviando(true);

  const respuesta = await fetch(
    "/api/campanas/lote",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        cliente_ids: seleccionados,
        mensaje_enviado:
          plantillaSeleccionada.bodyText,
        meta_template_name:
          plantillaSeleccionada.name,
        meta_template_language:
          plantillaSeleccionada.language,
        meta_variable_count:
          plantillaSeleccionada.variableCount,
        nuevo_estado_cliente:
          "contactado",
      }),
    }
  );

  const data =
    (await respuesta.json()) as RespuestaCampana;

  if (!respuesta.ok) {
    throw new Error(
      data.error ||
        "No se pudo enviar la campaña."
    );
  }

  const enviadas =
    data.enviadas ??
    data.lote?.total_enviadas ??
    0;

  const fallidas =
    data.fallidas ??
    data.lote?.total_fallidas ??
    0;

  setMensaje(
  `Meta aceptó ${enviadas} solicitud(es). Fallos inmediatos: ${fallidas}. La entrega está pendiente de confirmación.`
);

  setSeleccionados([]);
  router.refresh();
} catch (errorDesconocido) {
  const detalle =
    errorDesconocido instanceof Error
      ? errorDesconocido.message
      : String(errorDesconocido);

  setError(detalle);
} finally {
  setEnviando(false);
}


}

return ( <section className="rounded-xl border border-gray-200 bg-white shadow-sm"> <div className="border-b border-gray-200 p-4"> <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"> <div> <h2 className="text-lg font-bold text-gray-900">
Clientes encontrados </h2>


        <p className="text-sm text-gray-500">
          Selecciona clientes desde esta
          misma tabla y envía campañas por
          API oficial.
        </p>
      </div>

      <div className="inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-700">
        {seleccionados.length}{" "}
        seleccionado(s)
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <select
        className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-black disabled:bg-gray-100"
        value={
          plantillaSeleccionada
            ? `${plantillaSeleccionada.name}__${plantillaSeleccionada.language}`
            : ""
        }
        disabled={
          cargandoPlantillas ||
          enviando
        }
        onChange={(event) => {
          const [name, language] =
            event.target.value.split(
              "__"
            );

          const plantilla =
            plantillas.find(
              (item) =>
                item.name === name &&
                item.language ===
                  language
            );

          setPlantillaSeleccionada(
            plantilla || null
          );

          setMensaje("");
          setError("");
        }}
      >
        <option value="">
          {cargandoPlantillas
            ? "Cargando plantillas de Meta..."
            : "Seleccionar plantilla aprobada de Meta"}
        </option>

        {plantillas.map(
          (plantilla) => (
            <option
              key={`${plantilla.name}-${plantilla.language}`}
              value={`${plantilla.name}__${plantilla.language}`}
            >
              {plantilla.name} -{" "}
              {plantilla.language}
            </option>
          )
        )}
      </select>

      <button
        type="button"
        onClick={seleccionarPagina}
        disabled={
          enviando ||
          clientes.length === 0
        }
        className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {seleccionados.length > 0
          ? "Quitar selección"
          : "Seleccionar página"}
      </button>

      <button
        type="button"
        onClick={
          enviarCampanaSeleccionados
        }
        disabled={
          enviando ||
          seleccionados.length === 0 ||
          !plantillaSeleccionada
        }
        className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {enviando
          ? "Enviando..."
          : "Enviar campaña"}
      </button>
    </div>

    {plantillaSeleccionada && (
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">
          Vista previa:
        </p>

        <p className="mt-1">
          {
            plantillaSeleccionada.bodyText
          }
        </p>
      </div>
    )}

    {mensaje && (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
        {mensaje}
      </div>
    )}

    {error && (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
        {error}
      </div>
    )}
  </div>

  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-sm">
      <thead className="bg-gray-50 text-gray-700">
        <tr>
          <th className="border-b border-gray-200 p-3 text-center">
            <input
              type="checkbox"
              checked={
                todosPermitidosSeleccionados
              }
              onChange={
                toggleSeleccionarTodos
              }
              disabled={
                enviando ||
                clientes.length === 0
              }
              className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
              title="Seleccionar todos los clientes visibles de esta página"
            />
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Nombre
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Cédula
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Teléfono
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Última edición
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Estado
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Notas
          </th>

          <th className="border-b border-gray-200 p-3 text-left">
            Acciones
          </th>
        </tr>
      </thead>

      <tbody>
        {clientes.length === 0 && (
          <tr>
            <td
              colSpan={8}
              className="p-6 text-center text-sm font-semibold text-gray-500"
            >
              No hay clientes para
              mostrar.
            </td>
          </tr>
        )}

        {clientes.map((cliente) => {
          const estaSeleccionado =
            seleccionados.includes(
              cliente.id
            );

          const seleccionBloqueada =
            !estaSeleccionado &&
            seleccionados.length >=
              LIMITE_SELECCION;

          return (
            <tr
              key={cliente.id}
              className={`transition hover:bg-gray-50 ${
                estaSeleccionado
                  ? "bg-green-50"
                  : "bg-white"
              }`}
            >
              <td className="border-b border-gray-100 p-3 text-center">
                <input
                  type="checkbox"
                  checked={
                    estaSeleccionado
                  }
                  onChange={() =>
                    cambiarSeleccion(
                      cliente.id
                    )
                  }
                  disabled={
                    enviando ||
                    seleccionBloqueada
                  }
                  className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                />
              </td>

              <td className="border-b border-gray-100 p-3 font-medium text-gray-900">
                {cliente.nombre}
              </td>

              <td className="border-b border-gray-100 p-3 text-gray-700">
                {cliente.cedula}
              </td>

              <td className="border-b border-gray-100 p-3 text-gray-700">
                {cliente.telefono}
              </td>

              <td
                className="border-b border-gray-100 p-3 text-gray-700"
                suppressHydrationWarning
              >
                {formatearFecha(
                  cliente.ultimo_contacto
                )}
              </td>

              <td className="border-b border-gray-100 p-3">
                <EstadoSelect
                  clienteId={cliente.id}
                  estadoActual={
                    cliente.estado ||
                    "pendiente"
                  }
                />
              </td>

              <td className="border-b border-gray-100 p-3">
                <NotasCliente
                  clienteId={cliente.id}
                  notaActual={
                    cliente.notas
                  }
                />
              </td>

              <td className="border-b border-gray-100 p-3">
                <div className="flex flex-wrap gap-2">
                  <EditarCliente
                    cliente={cliente}
                  />

                  <EliminarCliente
                    id={cliente.id}
                    nombre={
                      cliente.nombre
                    }
                  />

                  <BotonCampaña
                    clienteId={
                      cliente.id
                    }
                    nombreCliente={
                      cliente.nombre
                    }
                    telefonoCliente={
                      cliente.telefono
                    }
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
</section>


);
}
