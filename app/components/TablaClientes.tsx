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

type ClienteVistaPrevia = {
  cliente_id: string;
  nombre?: string;
  telefono?: string;
  estado?: string | null;
  codigo?: string;
  motivo?: string;
};

type VistaPreviaCampana = {
  ok: boolean;
  total_seleccionados: number;
  total_encontrados: number;
  total_enviables: number;
  total_omitidos: number;
  omitidos_no_encontrados: number;
  omitidos_no_responde: number;
  omitidos_duplicados: number;
  omitidos_telefono_invalido: number;
  clientes_enviables: ClienteVistaPrevia[];
  clientes_omitidos: ClienteVistaPrevia[];
  error?: string;
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
  const [cargandoVistaPrevia, setCargandoVistaPrevia] =
    useState(false);

  const [vistaPrevia, setVistaPrevia] =
    useState<VistaPreviaCampana | null>(null);

  const [mostrandoVistaPrevia, setMostrandoVistaPrevia] =
    useState(false);

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

  function crearPayloadCampana() {
    if (!plantillaSeleccionada) {
      return null;
    }

    return {
      cliente_ids: seleccionados,
      mensaje_enviado: plantillaSeleccionada.bodyText,
      meta_template_name: plantillaSeleccionada.name,
      meta_template_language: plantillaSeleccionada.language,
      meta_variable_count: plantillaSeleccionada.variableCount,
      nuevo_estado_cliente: "contactado",
    };
  }

  async function previsualizarCampanaSeleccionados() {
    try {
      setMensaje("");
      setError("");
      setVistaPrevia(null);
      setMostrandoVistaPrevia(false);

      if (seleccionados.length === 0) {
        setError("Selecciona al menos un cliente.");
        return;
      }

      if (seleccionados.length > LIMITE_SELECCION) {
        setError(
          `Solo puedes enviar máximo ${LIMITE_SELECCION} clientes visibles.`,
        );
        return;
      }

      if (!plantillaSeleccionada) {
        setError("Selecciona una plantilla aprobada de Meta.");
        return;
      }

      const payload = crearPayloadCampana();

      if (!payload) {
        setError("Selecciona una plantilla aprobada de Meta.");
        return;
      }

      setCargandoVistaPrevia(true);

      const respuesta = await fetch(
        "/api/campanas/lote/vista-previa",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = (await respuesta.json()) as VistaPreviaCampana;

      if (!respuesta.ok) {
        throw new Error(
          data.error || "No se pudo generar la vista previa.",
        );
      }

      setVistaPrevia(data);
      setMostrandoVistaPrevia(true);
    } catch (errorDesconocido) {
      const detalle =
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : String(errorDesconocido);

      setError(detalle);
    } finally {
      setCargandoVistaPrevia(false);
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

      const payload = crearPayloadCampana();

      if (!payload) {
        setError("Selecciona una plantilla aprobada de Meta.");
        return;
      }

      const respuesta = await fetch("/api/campanas/lote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

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
      setVistaPrevia(null);
      setMostrandoVistaPrevia(false);
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

  return (<section className="rounded-xl border border-gray-200 bg-white shadow-sm"> <div className="border-b border-gray-200 p-4"> <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"> <div> <h2 className="text-lg font-bold text-gray-900">
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
        onClick={previsualizarCampanaSeleccionados}
        disabled={
          enviando ||
          cargandoVistaPrevia ||
          seleccionados.length === 0 ||
          !plantillaSeleccionada
        }
        className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {cargandoVistaPrevia
          ? "Revisando..."
          : enviando
            ? "Enviando..."
            : "Revisar campaña"}
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

    {mostrandoVistaPrevia && vistaPrevia && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Revisar campaña antes de enviar
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Confirma los datos antes de enviar mensajes reales por la
                API oficial de WhatsApp.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMostrandoVistaPrevia(false)}
              disabled={enviando}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Plantilla:
            </p>

            <p className="mt-1 text-sm text-gray-700">
              {plantillaSeleccionada?.name} -{" "}
              {plantillaSeleccionada?.language}
            </p>

            <p className="mt-3 text-sm font-semibold text-gray-900">
              Mensaje:
            </p>

            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
              {plantillaSeleccionada?.bodyText}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500">
                Seleccionados
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {vistaPrevia.total_seleccionados}
              </p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-700">
                Se enviarán
              </p>
              <p className="text-2xl font-bold text-green-800">
                {vistaPrevia.total_enviables}
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">
                Omitidos
              </p>
              <p className="text-2xl font-bold text-amber-800">
                {vistaPrevia.total_omitidos}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500">
                Estado nuevo
              </p>
              <p className="text-lg font-bold text-gray-900">
                Contactado
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <p className="font-bold text-gray-900">
                Motivos de omisión
              </p>

              <div className="mt-2 space-y-1 text-gray-700">
                <p>
                  No encontrados:{" "}
                  <strong>{vistaPrevia.omitidos_no_encontrados}</strong>
                </p>
                <p>
                  No responde:{" "}
                  <strong>{vistaPrevia.omitidos_no_responde}</strong>
                </p>
                <p>
                  Duplicados recientes:{" "}
                  <strong>{vistaPrevia.omitidos_duplicados}</strong>
                </p>
                <p>
                  Teléfono inválido:{" "}
                  <strong>{vistaPrevia.omitidos_telefono_invalido}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <p className="font-bold text-gray-900">
                Clientes que recibirán campaña
              </p>

              {vistaPrevia.clientes_enviables.length > 0 ? (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-gray-700">
                  {vistaPrevia.clientes_enviables
                    .slice(0, 10)
                    .map((cliente) => (
                      <li key={cliente.cliente_id}>
                        {cliente.nombre || "Sin nombre"} -{" "}
                        {cliente.telefono || "Sin teléfono"}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 font-semibold text-red-700">
                  No hay clientes disponibles para enviar.
                </p>
              )}
            </div>
          </div>

          {vistaPrevia.clientes_omitidos.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-bold text-amber-900">
                Primeros clientes omitidos
              </p>

              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-amber-900">
                {vistaPrevia.clientes_omitidos
                  .slice(0, 10)
                  .map((cliente) => (
                    <li key={`${cliente.cliente_id}-${cliente.codigo}`}>
                      {cliente.nombre || cliente.cliente_id} -{" "}
                      {cliente.motivo || cliente.codigo}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setMostrandoVistaPrevia(false)}
              disabled={enviando}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={enviarCampanaSeleccionados}
              disabled={enviando || vistaPrevia.total_enviables === 0}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {enviando
                ? "Enviando..."
                : `Confirmar y enviar ${vistaPrevia.total_enviables}`}
            </button>
          </div>
        </div>
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
                className={`transition hover:bg-gray-50 ${estaSeleccionado
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
