import { prisma } from "@/lib/prisma";
import { exigirUsuarioPagina } from "@/lib/auth/exigirUsuarioPagina";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import CambiarEstadoRapido from "./CambiarEstadoRapido";
import CambiarEtiquetaConversacion from "./CambiarEtiquetaConversacion";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  buscar?: string;
  no_leidos?: string;
  estado?: string;
  pagina?: string;
  tipo_contacto?: string;
  etiqueta?: string;
}>;

const estadosFiltro = ["abierta", "cerrada", "archivada"] as const;

type EstadoFiltro = (typeof estadosFiltro)[number];

function esEstadoFiltro(valor: string | undefined): valor is EstadoFiltro {
  return (
    typeof valor === "string" &&
    estadosFiltro.includes(valor as EstadoFiltro)
  );
}

const tiposContactoFiltro = ["registrado", "desconocido"] as const;

type TipoContactoFiltro = (typeof tiposContactoFiltro)[number];

const etiquetasComerciales = [
  "interesado",
  "pendiente",
  "cliente",
  "no_responde",
] as const;

type EtiquetaComercial = (typeof etiquetasComerciales)[number];

function esEtiquetaComercial(
  valor: string | undefined,
): valor is EtiquetaComercial {
  return (
    typeof valor === "string" &&
    etiquetasComerciales.includes(valor as EtiquetaComercial)
  );
}

function obtenerEtiquetaComercial(
  metadata: Prisma.JsonValue,
): EtiquetaComercial | "" {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    const valor = (metadata as Record<string, unknown>)
      .etiqueta_comercial;

    if (typeof valor === "string" && esEtiquetaComercial(valor)) {
      return valor;
    }
  }

  return "";
}

function nombreEtiquetaComercial(etiqueta: EtiquetaComercial | ""): string {
  const nombres: Record<EtiquetaComercial, string> = {
    interesado: "Interesado",
    pendiente: "Pendiente",
    cliente: "cliente",
    no_responde: "No responde",
  };

  return etiqueta ? nombres[etiqueta] : "Sin etiqueta";
}

function clasesEtiquetaComercial(etiqueta: EtiquetaComercial | ""): string {
  const clases: Record<EtiquetaComercial, string> = {
    interesado: "bg-emerald-100 text-emerald-800",
    pendiente: "bg-yellow-100 text-yellow-800",
   cliente: "bg-blue-100 text-blue-800",
    no_responde: "bg-red-100 text-red-800",
  };

  return etiqueta ? clases[etiqueta] : "bg-slate-100 text-slate-600";
}

function esTipoContactoFiltro(
  valor: string | undefined,
): valor is TipoContactoFiltro {
  return (
    typeof valor === "string" &&
    tiposContactoFiltro.includes(valor as TipoContactoFiltro)
  );
}

const formateadorFecha = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

function formatearFecha(fecha: Date | null): string {
  if (!fecha) {
    return "Sin fecha";
  }

  return formateadorFecha.format(fecha);
}

function obtenerResumenMensaje(
  mensaje: string | null,
  tipo: string | null,
): string {
  if (mensaje?.trim()) {
    return mensaje.trim();
  }

  switch (tipo) {
    case "image":
      return "Imagen";
    case "audio":
      return "Audio";
    case "document":
      return "Documento";
    case "video":
      return "Video";
    case "sticker":
      return "Sticker";
    case "location":
      return "Ubicación";
    case "contacts":
      return "Contacto compartido";
    case "interactive":
      return "Mensaje interactivo";
    case "reaction":
      return "Reacción";
    case "button":
      return "Respuesta de botón";
    case "order":
      return "Pedido";
    case "system":
      return "Mensaje del sistema";
    case "template":
      return "Plantilla";
    default:
      return "Mensaje sin contenido";
  }
}

function clasesEstado(estado: string): string {
  if (estado === "abierta") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (estado === "cerrada") {
    return "bg-slate-200 text-slate-700";
  }

  if (estado === "archivada") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

function inicialContacto(nombre: string | null): string {
  const nombreLimpio = nombre?.trim();

  if (!nombreLimpio) {
    return "?";
  }

  return nombreLimpio.charAt(0).toUpperCase();
}

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await exigirUsuarioPagina();

  const parametros = await searchParams;

  const buscar = parametros.buscar?.trim() ?? "";
  const soloNoLeidos = parametros.no_leidos === "1";
  const estadoFiltro = esEstadoFiltro(parametros.estado)
    ? parametros.estado
    : "";
  const tipoContactoFiltro = esTipoContactoFiltro(
    parametros.tipo_contacto,
  )
    ? parametros.tipo_contacto
    : "";
  const etiquetaFiltro = esEtiquetaComercial(parametros.etiqueta)
    ? parametros.etiqueta
    : "";
  const paginaParametro = Number(parametros.pagina ?? "1");

  const paginaActual =
    Number.isFinite(paginaParametro) && paginaParametro > 0
      ? Math.floor(paginaParametro)
      : 1;

  const conversacionesPorPagina = 20;
  const salto = (paginaActual - 1) * conversacionesPorPagina;

  const where: Prisma.conversaciones_whatsappWhereInput = {};

  if (buscar) {
    where.OR = [
      {
        nombre_cliente: {
          contains: buscar,
          mode: "insensitive",
        },
      },
      {
        telefono_cliente: {
          contains: buscar,
          mode: "insensitive",
        },
      },
      {
        ultimo_mensaje: {
          contains: buscar,
          mode: "insensitive",
        },
      },
    ];
  }

  if (soloNoLeidos) {
    where.no_leidos = {
      gt: 0,
    };
  }
  if (estadoFiltro) {
    where.estado = estadoFiltro;
  }

  if (tipoContactoFiltro === "registrado") {
    where.cliente_id = {
      not: null,
    };
  }

  if (tipoContactoFiltro === "desconocido") {
    where.cliente_id = null;
  }

  if (etiquetaFiltro) {
    where.metadata = {
      path: ["etiqueta_comercial"],
      equals: etiquetaFiltro,
    };
  }

  const [
    conversaciones,
    totalConversaciones,
    totalConversacionesFiltradas,
    resumenMensajesNoLeidos,
    conteosPorEstado,
    totalClientesRegistrados,
    totalContactosDesconocidos,
  ] = await Promise.all([
    prisma.conversaciones_whatsapp.findMany({
      where,
      skip: salto,
      take: conversacionesPorPagina,
      select: {
        id: true,
        cliente_id: true,
        telefono_cliente: true,
        nombre_cliente: true,
        ultimo_mensaje: true,
        ultimo_tipo: true,
        ultima_direccion: true,
        fecha_ultimo_mensaje: true,
        ventana_atencion_hasta: true,
        no_leidos: true,
        estado: true,
        metadata: true,
      },
      orderBy: [
        {
          fecha_ultimo_mensaje: "desc",
        },
        {
          created_at: "desc",
        },
      ],
    }),

    prisma.conversaciones_whatsapp.count(),

    prisma.conversaciones_whatsapp.count({
      where,
    }),

    prisma.conversaciones_whatsapp.aggregate({
      _sum: {
        no_leidos: true,
      },
    }),
    prisma.conversaciones_whatsapp.groupBy({
      by: ["estado"],
      _count: {
        _all: true,
      },
    }),
    prisma.conversaciones_whatsapp.count({
      where: {
        cliente_id: {
          not: null,
        },
      },
    }),

    prisma.conversaciones_whatsapp.count({
      where: {
        cliente_id: null,
      },
    }),
  ]);

  const totalMensajesNoLeidos =
    resumenMensajesNoLeidos._sum.no_leidos ?? 0;
  const totalAbiertas =
    conteosPorEstado.find((item) => item.estado === "abierta")?._count
      ._all ?? 0;

  const totalCerradas =
    conteosPorEstado.find((item) => item.estado === "cerrada")?._count
      ._all ?? 0;

  const totalArchivadas =
    conteosPorEstado.find((item) => item.estado === "archivada")?._count
      ._all ?? 0;

  const totalPaginas = Math.max(
    1,
    Math.ceil(totalConversacionesFiltradas / conversacionesPorPagina),
  );
  const inicioResultado =
    conversaciones.length === 0 ? 0 : salto + 1;

  const finResultado =
    conversaciones.length === 0
      ? 0
      : Math.min(
        salto + conversaciones.length,
        totalConversacionesFiltradas,
      );

  function crearHrefPagina(pagina: number) {
    const query = new URLSearchParams();

    if (buscar) {
      query.set("buscar", buscar);
    }

    if (soloNoLeidos) {
      query.set("no_leidos", "1");
    }

    if (estadoFiltro) {
      query.set("estado", estadoFiltro);
    }

    if (tipoContactoFiltro) {
      query.set("tipo_contacto", tipoContactoFiltro);
    }

    if (etiquetaFiltro) {
      query.set("etiqueta", etiquetaFiltro);
    }

    if (pagina > 1) {
      query.set("pagina", String(pagina));
    }

    const queryString = query.toString();

    return queryString ? `/bandeja?${queryString}` : "/bandeja";
  }

  const ahora = new Date();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              WhatsApp Cloud API
            </p>

            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Bandeja de conversaciones
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Consulta los mensajes recibidos por WhatsApp.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Volver a clientes
          </Link>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Conversaciones
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalConversaciones}
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Mensajes sin leer
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {totalMensajesNoLeidos}
            </p>
          </article>
        </section>
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/bandeja?estado=abierta"
            className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm hover:bg-emerald-50"
          >
            <p className="text-sm font-medium text-slate-500">Abiertas</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {totalAbiertas}
            </p>
          </Link>

          <Link
            href="/bandeja?estado=cerrada"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
          >
            <p className="text-sm font-medium text-slate-500">Cerradas</p>
            <p className="mt-2 text-2xl font-bold text-slate-700">
              {totalCerradas}
            </p>
          </Link>

          <Link
            href="/bandeja?estado=archivada"
            className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm hover:bg-amber-50"
          >
            <p className="text-sm font-medium text-slate-500">Archivadas</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">
              {totalArchivadas}
            </p>
          </Link>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/bandeja?tipo_contacto=registrado"
            className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm hover:bg-violet-50"
          >
            <p className="text-sm font-medium text-slate-500">
              Clientes registrados
            </p>
            <p className="mt-2 text-2xl font-bold text-violet-700">
              {totalClientesRegistrados}
            </p>
          </Link>

          <Link
            href="/bandeja?tipo_contacto=desconocido"
            className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm hover:bg-amber-50"
          >
            <p className="text-sm font-medium text-slate-500">
              Contactos desconocidos
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-700">
              {totalContactosDesconocidos}
            </p>
          </Link>
        </section>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <form
            method="GET"
            className="flex flex-col gap-4 lg:flex-row lg:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="buscar"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Buscar conversación
              </label>

              <input
                id="buscar"
                name="buscar"
                type="search"
                defaultValue={buscar}
                placeholder="Nombre, teléfono o último mensaje"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="w-full lg:w-56">
              <label
                htmlFor="estado"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Estado
              </label>

              <select
                id="estado"
                name="estado"
                defaultValue={estadoFiltro}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todas</option>
                <option value="abierta">Abiertas</option>
                <option value="cerrada">Cerradas</option>
                <option value="archivada">Archivadas</option>
              </select>
            </div>

            <div className="w-full lg:w-56">
              <label
                htmlFor="tipo_contacto"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Contacto
              </label>

              <select
                id="tipo_contacto"
                name="tipo_contacto"
                defaultValue={tipoContactoFiltro}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todos</option>
                <option value="registrado">Clientes registrados</option>
                <option value="desconocido">Contactos desconocidos</option>
              </select>
            </div>

            <div className="w-full lg:w-56">
              <label
                htmlFor="etiqueta"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Etiqueta
              </label>

              <select
                id="etiqueta"
                name="etiqueta"
                defaultValue={etiquetaFiltro}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todas</option>
                <option value="interesado">Interesado</option>
                <option value="pendiente">Pendiente</option>
                <option value="contactado">Contactado</option>
                <option value="cliente">cliente</option>
                <option value="no_responde">No responde</option>
              </select>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="no_leidos"
                value="1"
                defaultChecked={soloNoLeidos}
                className="h-4 w-4 rounded border-slate-300"
              />

              Solo no leídos
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 lg:flex-none"
              >
                Buscar
              </button>

              {(buscar ||
                soloNoLeidos ||
                estadoFiltro ||
                tipoContactoFiltro ||
                etiquetaFiltro) && (
                  <Link
                    href="/bandeja"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:flex-none"
                  >
                    Limpiar
                  </Link>
                )}
            </div>
          </form>
        </section>

        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">
            Conversaciones encontradas
          </h2>

          <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">
            {totalConversacionesFiltradas}
          </span>
        </div>

        <p className="mb-3 text-sm text-slate-500">
          Mostrando {inicioResultado}–{finResultado} de{" "}
          {totalConversacionesFiltradas} conversaciones
        </p>

        {conversaciones.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-slate-800">
              No se encontraron conversaciones
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Prueba cambiando la búsqueda o quitando los filtros activos.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {conversaciones.map((conversacion) => {
              const nombre =
                conversacion.nombre_cliente?.trim() ||
                "Contacto sin nombre";

              const ventanaActiva =
                conversacion.ventana_atencion_hasta !== null &&
                conversacion.ventana_atencion_hasta > ahora;

              const mensaje = obtenerResumenMensaje(
                conversacion.ultimo_mensaje,
                conversacion.ultimo_tipo,
              );

              const etiquetaComercial = obtenerEtiquetaComercial(
                conversacion.metadata,
              );

              return (
                <article
                  key={conversacion.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                      {inicialContacto(conversacion.nombre_cliente)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-slate-900">
                            {nombre}
                          </h3>

                          <p className="mt-0.5 text-sm text-slate-500">
                            {conversacion.telefono_cliente}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {conversacion.no_leidos > 0 && (
                            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                              {conversacion.no_leidos}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${clasesEstado(
                              conversacion.estado,
                            )}`}
                          >
                            {conversacion.estado}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xs font-semibold uppercase text-slate-400">
                          {conversacion.ultima_direccion === "entrante"
                            ? "Recibido"
                            : conversacion.ultima_direccion ===
                              "saliente"
                              ? "Enviado"
                              : "Mensaje"}
                        </span>

                        <p className="truncate text-sm text-slate-700">
                          {mensaje}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ventanaActiva
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-600"
                              }`}
                          >
                            {ventanaActiva
                              ? "Ventana de 24 horas activa"
                              : "Ventana de 24 horas cerrada"}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${conversacion.cliente_id
                              ? "bg-violet-100 text-violet-800"
                              : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {conversacion.cliente_id
                              ? "Cliente registrado"
                              : "Contacto desconocido"}
                          </span>

                          {etiquetaComercial ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${clasesEtiquetaComercial(
                                etiquetaComercial,
                              )}`}
                            >
                              {nombreEtiquetaComercial(etiquetaComercial)}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <time className="text-xs font-medium text-slate-500">
                            {formatearFecha(
                              conversacion.fecha_ultimo_mensaje,
                            )}
                          </time>

                          <CambiarEtiquetaConversacion
                            conversacionId={conversacion.id}
                            etiquetaActual={etiquetaComercial}
                          />

                          <CambiarEstadoRapido
                            conversacionId={conversacion.id}
                            estadoActual={conversacion.estado as "abierta" | "cerrada" | "archivada"}
                          />

                          <Link
                            href={`/bandeja/${conversacion.id}`}
                            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                          >
                            Ver conversación
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {totalPaginas > 1 ? (
          <nav className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">
              Página {paginaActual} de {totalPaginas}
            </p>

            <div className="flex gap-2">
              {paginaActual > 1 ? (
                <Link
                  href={crearHrefPagina(paginaActual - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Anterior
                </Link>
              ) : null}

              {paginaActual < totalPaginas ? (
                <Link
                  href={crearHrefPagina(paginaActual + 1)}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Siguiente
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </main>
  );
}