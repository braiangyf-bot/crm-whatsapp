import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

const LOTES_POR_PAGINA = 10;
const ENVIOS_POR_PAGINA = 25;

type SearchParams = Promise<{
  lote_search?: string;
  estado_lote?: string;
  lote_id?: string;
  search?: string;
  estado?: string;
  estado_api?: string;
  canal?: string;
  pagina_lotes?: string;
  pagina_envios?: string;
}>;

type Lote = {
  id: string;
  created_at: Date | null;
  nombre_plantilla: string;
  mensaje: string | null;
  total_clientes: number;
  total_enviadas: number;
  total_fallidas: number;
  estado: string;
};

type ResumenLotes = {
  total_lotes: number;
  total_clientes: number;
  total_enviadas: number;
  total_fallidas: number;
};

type Envio = {
  id: string;
  created_at: Date | null;
  lote_id: string | null;
  cliente_id: string | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  nombre_plantilla: string | null;
  mensaje_enviado: string | null;
  estado: string | null;
  canal: string | null;
  whatsapp_message_id: string | null;
  estado_api: string | null;
  error_api: string | null;
  fecha_enviado_api: Date | null;
  fecha_entregado: Date | null;
  fecha_leido: Date | null;
  fecha_fallido: Date | null;
};

type ResumenEnvios = {
  total: number;
  enviadas: number;
  fallidas: number;
  aceptadas: number;
  entregadas: number;
  leidas: number;
  telefonos_invalidos: number;
};

function obtenerPagina(valor: string | undefined): number {
  const pagina = Number(valor);

  if (!Number.isInteger(pagina) || pagina < 1) {
    return 1;
  }

  return pagina;
}

function obtenerPaginasVisibles(
  paginaActual: number,
  totalPaginas: number,
  maximoVisible = 5
): number[] {
  const cantidad = Math.min(maximoVisible, totalPaginas);

  let inicio = Math.max(
    1,
    paginaActual - Math.floor(cantidad / 2)
  );

  let fin = inicio + cantidad - 1;

  if (fin > totalPaginas) {
    fin = totalPaginas;
    inicio = Math.max(1, fin - cantidad + 1);
  }

  return Array.from(
    { length: fin - inicio + 1 },
    (_, indice) => inicio + indice
  );
}

function formatearFecha(fecha: Date | null): string {
  if (!fecha) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
}

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}

function etiqueta(valor: string | null): string {
  if (!valor) {
    return "—";
  }

  return valor.replaceAll("_", " ");
}

function claseEstadoLote(estado: string): string {
  switch (estado) {
    case "finalizado":
      return "border-green-200 bg-green-100 text-green-700";
    case "finalizado_con_errores":
      return "border-yellow-200 bg-yellow-100 text-yellow-800";
    case "fallido":
      return "border-red-200 bg-red-100 text-red-700";
    case "procesando":
      return "border-blue-200 bg-blue-100 text-blue-700";
    default:
      return "border-gray-200 bg-gray-100 text-gray-700";
  }
}

function claseEstadoEnvio(estado: string | null): string {
  switch (estado) {
    case "enviada_api":
      return "border-green-200 bg-green-100 text-green-700";
    case "fallida_api":
      return "border-red-200 bg-red-100 text-red-700";
    case "abierta_whatsapp":
      return "border-blue-200 bg-blue-100 text-blue-700";
    default:
      return "border-gray-200 bg-gray-100 text-gray-700";
  }
}

function claseEstadoApi(estadoApi: string | null): string {
  if (
    estadoApi === "accepted" ||
    estadoApi === "sent" ||
    estadoApi === "delivered" ||
    estadoApi === "read"
  ) {
    return "border-blue-200 bg-blue-100 text-blue-700";
  }

  if (estadoApi === "failed") {
    return "border-red-200 bg-red-100 text-red-700";
  }

  if (estadoApi === "invalid_phone") {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  return "border-gray-200 bg-gray-100 text-gray-700";
}

function limpiarError(errorApi: string | null): string {
  if (!errorApi) {
    return "\u2014";
  }

  try {
    const parsed = JSON.parse(errorApi) as {
      errors?: Array<{
        code?: number | string;
        title?: string;
        message?: string;
        error_data?: {
          details?: string;
        };
      }>;
      error?:
      | {
        code?: number | string;
        message?: string;
        error_user_msg?: string;
        error_user_title?: string;
        error_data?: {
          details?: string;
        };
      }
      | string;
      message?: string;
      recipient_id?: string | null;
    };

    const errorWebhook = Array.isArray(parsed.errors)
      ? parsed.errors[0]
      : undefined;

    const errorDirecto =
      typeof parsed.error === "object" && parsed.error
        ? parsed.error
        : undefined;

    const codigo =
      errorWebhook?.code ??
      errorDirecto?.code;

    const titulo =
      errorWebhook?.title ??
      errorDirecto?.error_user_title;

    const mensaje =
      errorWebhook?.error_data?.details ||
      errorWebhook?.message ||
      errorDirecto?.error_user_msg ||
      errorDirecto?.error_data?.details ||
      errorDirecto?.message ||
      parsed.message ||
      (typeof parsed.error === "string"
        ? parsed.error
        : undefined);

    const partes: string[] = [];

    if (codigo !== undefined) {
      partes.push(`Codigo Meta: ${codigo}`);
    }

    if (String(codigo) === "131049") {
      partes.push(
        "Meta bloqueo la entrega para mantener una interaccion saludable con el destinatario."
      );
    }

    if (titulo && titulo !== mensaje) {
      partes.push(`Titulo: ${titulo}`);
    }

    if (mensaje) {
      partes.push(`Detalle: ${mensaje}`);
    }

    if (parsed.recipient_id) {
      partes.push(`Destinatario: ${parsed.recipient_id}`);
    }

    return partes.length > 0
      ? partes.join("\n")
      : JSON.stringify(parsed, null, 2);
  } catch {
    return errorApi;
  }
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const loteSearch = String(params.lote_search || "").trim();
  const estadoLote = String(params.estado_lote || "todos").trim();

  const loteIdRecibido = String(params.lote_id || "").trim();
  const loteId = esUuid(loteIdRecibido) ? loteIdRecibido : "";

  const search = String(params.search || "").trim();
  const estado = String(params.estado || "todos").trim();
  const estadoApi = String(params.estado_api || "todos").trim();
  const canal = String(params.canal || "todos").trim();

  const paginaLotesSolicitada = obtenerPagina(params.pagina_lotes);
  const paginaEnviosSolicitada = obtenerPagina(params.pagina_envios);

  const condicionesLotes: Prisma.Sql[] = [Prisma.sql`1 = 1`];

  if (estadoLote !== "todos") {
    condicionesLotes.push(Prisma.sql`estado = ${estadoLote}`);
  }

  if (loteSearch) {
    const terminosLote = loteSearch
      .split(/\s+/)
      .map((termino) => termino.trim())
      .filter(Boolean);

    const condicionesBusquedaLote = terminosLote.map((termino) => {
      const patron = `%${termino}%`;

      return Prisma.sql`(
        nombre_plantilla ILIKE ${patron}
        OR COALESCE(mensaje, '') ILIKE ${patron}
        OR id::text ILIKE ${patron}
      )`;
    });

    if (condicionesBusquedaLote.length > 0) {
      condicionesLotes.push(
        Prisma.sql`(${Prisma.join(condicionesBusquedaLote, " AND ")})`
      );
    }
  }

  const whereLotes = Prisma.sql`
    WHERE ${Prisma.join(condicionesLotes, " AND ")}
  `;

  const resumenLotesResultado =
  await prisma.$queryRaw<ResumenLotes[]>`
    WITH lotes_actuales AS (
      SELECT
        lote.id::text AS id,
        lote.nombre_plantilla,
        lote.mensaje,
        lote.total_clientes,

        COUNT(envio.id) FILTER (
          WHERE envio.whatsapp_message_id IS NOT NULL
        )::int AS total_enviadas,

        COUNT(envio.id) FILTER (
          WHERE envio.estado_api = 'failed'
          OR envio.estado = 'fallida_api'
        )::int AS total_fallidas,

        CASE
          WHEN lote.estado = 'procesando' THEN
            'procesando'

          WHEN COUNT(envio.id) FILTER (
            WHERE envio.estado_api = 'failed'
            OR envio.estado = 'fallida_api'
          ) = 0 THEN
            'finalizado'

          WHEN COUNT(envio.id) FILTER (
            WHERE envio.whatsapp_message_id IS NOT NULL
          ) > 0 THEN
            'finalizado_con_errores'

          ELSE
            'fallido'
        END AS estado

      FROM public.campanas_lotes AS lote

      LEFT JOIN public.campanas_enviadas AS envio
        ON envio.lote_id = lote.id

      GROUP BY
        lote.id,
        lote.nombre_plantilla,
        lote.mensaje,
        lote.total_clientes,
        lote.estado
    )

    SELECT
      COUNT(*)::int AS total_lotes,
      COALESCE(SUM(total_clientes), 0)::int AS total_clientes,
      COALESCE(SUM(total_enviadas), 0)::int AS total_enviadas,
      COALESCE(SUM(total_fallidas), 0)::int AS total_fallidas

    FROM lotes_actuales
    ${whereLotes}
  `;

  const resumenLotes = resumenLotesResultado[0] || {
    total_lotes: 0,
    total_clientes: 0,
    total_enviadas: 0,
    total_fallidas: 0,
  };

  const totalPaginasLotes = Math.max(
    1,
    Math.ceil(resumenLotes.total_lotes / LOTES_POR_PAGINA)
  );

  const paginaLotes = Math.min(
    paginaLotesSolicitada,
    totalPaginasLotes
  );

  const offsetLotes = (paginaLotes - 1) * LOTES_POR_PAGINA;

  const inicioLotes =
    resumenLotes.total_lotes === 0 ? 0 : offsetLotes + 1;

  const finLotes = Math.min(
    offsetLotes + LOTES_POR_PAGINA,
    resumenLotes.total_lotes
  );

  const lotes = await prisma.$queryRaw<Lote[]>`
  WITH lotes_actuales AS (
    SELECT
      lote.id::text AS id,
      lote.created_at,
      lote.nombre_plantilla,
      lote.mensaje,
      lote.total_clientes,

      COUNT(envio.id) FILTER (
        WHERE envio.whatsapp_message_id IS NOT NULL
      )::int AS total_enviadas,

      COUNT(envio.id) FILTER (
        WHERE envio.estado_api = 'failed'
        OR envio.estado = 'fallida_api'
      )::int AS total_fallidas,

      CASE
        WHEN lote.estado = 'procesando' THEN
          'procesando'

        WHEN COUNT(envio.id) FILTER (
          WHERE envio.estado_api = 'failed'
          OR envio.estado = 'fallida_api'
        ) = 0 THEN
          'finalizado'

        WHEN COUNT(envio.id) FILTER (
          WHERE envio.whatsapp_message_id IS NOT NULL
        ) > 0 THEN
          'finalizado_con_errores'

        ELSE
          'fallido'
      END AS estado

    FROM public.campanas_lotes AS lote

    LEFT JOIN public.campanas_enviadas AS envio
      ON envio.lote_id = lote.id

    GROUP BY
      lote.id,
      lote.created_at,
      lote.nombre_plantilla,
      lote.mensaje,
      lote.total_clientes,
      lote.estado
  )

  SELECT
    id,
    created_at,
    nombre_plantilla,
    mensaje,
    total_clientes,
    total_enviadas,
    total_fallidas,
    estado
  FROM lotes_actuales
  ${whereLotes}
  ORDER BY created_at DESC
  LIMIT ${LOTES_POR_PAGINA}
  OFFSET ${offsetLotes}
`;

 const loteSeleccionadoResultado = loteId
  ? await prisma.$queryRaw<Lote[]>`
      SELECT
        lote.id::text AS id,
        lote.created_at,
        lote.nombre_plantilla,
        lote.mensaje,
        lote.total_clientes,

        (
          COUNT(envio.id) FILTER (
            WHERE envio.whatsapp_message_id IS NOT NULL
          )
        )::int AS total_enviadas,

        (
          COUNT(envio.id) FILTER (
            WHERE envio.estado_api = 'failed'
            OR envio.estado = 'fallida_api'
          )
        )::int AS total_fallidas,

        CASE
          WHEN lote.estado = 'procesando' THEN
            'procesando'

          WHEN COUNT(envio.id) FILTER (
            WHERE envio.estado_api = 'failed'
            OR envio.estado = 'fallida_api'
          ) = 0 THEN
            'finalizado'

          WHEN COUNT(envio.id) FILTER (
            WHERE envio.whatsapp_message_id IS NOT NULL
          ) > 0 THEN
            'finalizado_con_errores'

          ELSE
            'fallido'
        END AS estado

      FROM public.campanas_lotes AS lote

      LEFT JOIN public.campanas_enviadas AS envio
        ON envio.lote_id = lote.id

      WHERE lote.id = ${loteId}::uuid

      GROUP BY
        lote.id,
        lote.created_at,
        lote.nombre_plantilla,
        lote.mensaje,
        lote.total_clientes,
        lote.estado

      LIMIT 1
    `
  : [];

  const loteSeleccionado =
    loteSeleccionadoResultado[0] || null;

  const condicionesEnvios: Prisma.Sql[] = [Prisma.sql`1 = 1`];

  if (loteId) {
    condicionesEnvios.push(
      Prisma.sql`lote_id = ${loteId}::uuid`
    );
  }

  if (estado !== "todos") {
    condicionesEnvios.push(Prisma.sql`estado = ${estado}`);
  }

  if (estadoApi !== "todos") {
    condicionesEnvios.push(
      Prisma.sql`estado_api = ${estadoApi}`
    );
  }

  if (canal !== "todos") {
    condicionesEnvios.push(Prisma.sql`canal = ${canal}`);
  }

  if (search) {
    const terminos = search
      .split(/\s+/)
      .map((termino) => termino.trim())
      .filter(Boolean);

    const condicionesBusquedaEnvio = terminos.map((termino) => {
      const patron = `%${termino}%`;

      return Prisma.sql`(
        COALESCE(nombre_cliente, '') ILIKE ${patron}
        OR COALESCE(telefono_cliente, '') ILIKE ${patron}
        OR COALESCE(nombre_plantilla, '') ILIKE ${patron}
        OR COALESCE(mensaje_enviado, '') ILIKE ${patron}
        OR COALESCE(estado, '') ILIKE ${patron}
        OR COALESCE(estado_api, '') ILIKE ${patron}
        OR COALESCE(whatsapp_message_id, '') ILIKE ${patron}
        OR COALESCE(lote_id::text, '') ILIKE ${patron}
      )`;
    });

    if (condicionesBusquedaEnvio.length > 0) {
      condicionesEnvios.push(
        Prisma.sql`(${Prisma.join(
          condicionesBusquedaEnvio,
          " AND "
        )})`
      );
    }
  }

  const whereEnvios = Prisma.sql`
    WHERE ${Prisma.join(condicionesEnvios, " AND ")}
  `;

  const resumenEnviosResultado =
    await prisma.$queryRaw<ResumenEnvios[]>`
    SELECT
      COUNT(*)::int AS total,

      COUNT(*) FILTER (
        WHERE whatsapp_message_id IS NOT NULL
      )::int AS aceptadas,

      COUNT(*) FILTER (
        WHERE estado_api IN (
          'sent',
          'delivered',
          'read'
        )
      )::int AS enviadas,

      COUNT(*) FILTER (
        WHERE estado_api IN (
          'delivered',
          'read'
        )
        OR fecha_entregado IS NOT NULL
      )::int AS entregadas,

      COUNT(*) FILTER (
        WHERE estado_api = 'read'
        OR fecha_leido IS NOT NULL
      )::int AS leidas,

      COUNT(*) FILTER (
        WHERE estado_api = 'failed'
        OR estado = 'fallida_api'
      )::int AS fallidas,

      COUNT(*) FILTER (
        WHERE estado_api = 'invalid_phone'
      )::int AS telefonos_invalidos

    FROM public.campanas_enviadas
    ${whereEnvios}
  `;

  const resumenEnvios = resumenEnviosResultado[0] || {
    total: 0,
    enviadas: 0,
    fallidas: 0,
    aceptadas: 0,
    entregadas: 0,
    leidas: 0,
    telefonos_invalidos: 0,
  };

  const totalPaginasEnvios = Math.max(
    1,
    Math.ceil(resumenEnvios.total / ENVIOS_POR_PAGINA)
  );

  const paginaEnvios = Math.min(
    paginaEnviosSolicitada,
    totalPaginasEnvios
  );

  const offsetEnvios =
    (paginaEnvios - 1) * ENVIOS_POR_PAGINA;

  const inicioEnvios =
    resumenEnvios.total === 0 ? 0 : offsetEnvios + 1;

  const finEnvios = Math.min(
    offsetEnvios + ENVIOS_POR_PAGINA,
    resumenEnvios.total
  );

  const envios = await prisma.$queryRaw<Envio[]>`
    SELECT
      id::text,
      created_at,
      lote_id::text,
      cliente_id::text,
      nombre_cliente,
      telefono_cliente,
      nombre_plantilla,
      mensaje_enviado,
      estado,
      canal,
      whatsapp_message_id,
      estado_api,
      error_api,
      fecha_enviado_api,
      fecha_entregado,
      fecha_leido,
      fecha_fallido
    FROM public.campanas_enviadas
    ${whereEnvios}
    ORDER BY created_at DESC
    LIMIT ${ENVIOS_POR_PAGINA}
    OFFSET ${offsetEnvios}
  `;

  function crearUrl(
    cambios: Record<string, string | null>
  ): string {
    const query = new URLSearchParams();

    if (loteSearch) {
      query.set("lote_search", loteSearch);
    }

    if (estadoLote !== "todos") {
      query.set("estado_lote", estadoLote);
    }

    if (loteId) {
      query.set("lote_id", loteId);
    }

    if (search) {
      query.set("search", search);
    }

    if (estado !== "todos") {
      query.set("estado", estado);
    }

    if (estadoApi !== "todos") {
      query.set("estado_api", estadoApi);
    }

    if (canal !== "todos") {
      query.set("canal", canal);
    }

    if (paginaLotes > 1) {
      query.set("pagina_lotes", String(paginaLotes));
    }

    if (paginaEnvios > 1) {
      query.set("pagina_envios", String(paginaEnvios));
    }

    for (const [clave, valor] of Object.entries(cambios)) {
      const esPagina =
        clave === "pagina_lotes" ||
        clave === "pagina_envios";

      if (
        valor === null ||
        valor === "" ||
        valor === "todos" ||
        (esPagina && valor === "1")
      ) {
        query.delete(clave);
      } else {
        query.set(clave, valor);
      }
    }

    const queryString = query.toString();

    return queryString
      ? `/campanas?${queryString}`
      : "/campanas";
  }

  function crearHrefDetalle(id: string): string {
    return (
      crearUrl({
        lote_id: id,
        search: null,
        estado: null,
        estado_api: null,
        canal: null,
        pagina_envios: "1",
      }) + "#detalle"
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Control de campañas
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Resumen de lotes y detalle de cada envío por
              WhatsApp.
            </p>
          </div>

          <Link
            href="/"
            className="w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Volver al CRM
          </Link>
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Campañas por lote
            </h2>

            <p className="text-sm text-gray-600">
              Cada registro representa una campaña enviada a
              uno o más clientes.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">
                Total de lotes
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {resumenLotes.total_lotes}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">
                Clientes procesados
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {resumenLotes.total_clientes}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">
                Envíos aceptados
              </p>
              <p className="text-2xl font-bold text-green-700">
                {resumenLotes.total_enviadas}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">
                Envíos fallidos
              </p>
              <p className="text-2xl font-bold text-red-700">
                {resumenLotes.total_fallidas}
              </p>
            </div>
          </div>

          <form
            action="/campanas"
            className="rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_230px_auto]">
              <input
                type="text"
                name="lote_search"
                defaultValue={loteSearch}
                placeholder="Buscar lote por plantilla, mensaje o ID..."
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              />

              <select
                name="estado_lote"
                defaultValue={estadoLote}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="todos">
                  Todos los estados
                </option>
                <option value="procesando">
                  Procesando
                </option>
                <option value="finalizado">
                  Finalizado
                </option>
                <option value="finalizado_con_errores">
                  Finalizado con errores
                </option>
                <option value="fallido">
                  Fallido
                </option>
              </select>

              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Buscar lotes
              </button>
            </div>

            <div className="mt-3">
              <Link
                href="/campanas"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Plantilla</th>
                    <th className="px-4 py-3">Clientes</th>
                    <th className="px-4 py-3">Aceptadas</th>
                    <th className="px-4 py-3">Fallidas</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acción</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {lotes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No se encontraron lotes.
                      </td>
                    </tr>
                  ) : (
                    lotes.map((lote) => {
                      const seleccionado =
                        lote.id === loteId;

                      return (
                        <tr
                          key={lote.id}
                          className={
                            seleccionado
                              ? "bg-blue-50"
                              : "hover:bg-gray-50"
                          }
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                            {formatearFecha(
                              lote.created_at
                            )}
                          </td>

                          <td className="max-w-[300px] px-4 py-3">
                            <p className="font-semibold text-gray-900">
                              {lote.nombre_plantilla}
                            </p>

                            {lote.mensaje && (
                              <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                                {lote.mensaje}
                              </p>
                            )}

                            <p
                              className="mt-1 max-w-[260px] truncate text-[11px] text-gray-400"
                              title={lote.id}
                            >
                              {lote.id}
                            </p>
                          </td>

                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {lote.total_clientes}
                          </td>

                          <td className="px-4 py-3 font-semibold text-green-700">
                            {lote.total_enviadas}
                          </td>

                          <td className="px-4 py-3 font-semibold text-red-700">
                            {lote.total_fallidas}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${claseEstadoLote(
                                lote.estado
                              )}`}
                            >
                              {etiqueta(lote.estado)}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <Link
                              href={crearHrefDetalle(
                                lote.id
                              )}
                              className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Ver detalle
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-500">
                Mostrando {inicioLotes} a {finLotes} de{" "}
                {resumenLotes.total_lotes} lotes. Página{" "}
                {paginaLotes} de {totalPaginasLotes}.
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {paginaLotes > 1 ? (
                  <Link
                    href={crearUrl({
                      pagina_lotes: String(
                        paginaLotes - 1
                      ),
                    })}
                    className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border bg-gray-100 px-3 py-2 text-sm text-gray-400">
                    Anterior
                  </span>
                )}

                {obtenerPaginasVisibles(
                  paginaLotes,
                  totalPaginasLotes
                ).map((numeroPagina) =>
                  numeroPagina === paginaLotes ? (
                    <span
                      key={numeroPagina}
                      aria-current="page"
                      className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {numeroPagina}
                    </span>
                  ) : (
                    <Link
                      key={numeroPagina}
                      href={crearUrl({
                        pagina_lotes: String(
                          numeroPagina
                        ),
                      })}
                      className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      {numeroPagina}
                    </Link>
                  )
                )}

                {paginaLotes <
                  totalPaginasLotes ? (
                  <Link
                    href={crearUrl({
                      pagina_lotes: String(
                        paginaLotes + 1
                      ),
                    })}
                    className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border bg-gray-100 px-3 py-2 text-sm text-gray-400">
                    Siguiente
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="detalle"
          className="scroll-mt-6 space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {loteSeleccionado
                  ? `Detalle del lote: ${loteSeleccionado.nombre_plantilla}`
                  : "Detalle de envíos"}
              </h2>

              <p className="text-sm text-gray-600">
                {loteSeleccionado
                  ? `Mostrando los envíos relacionados con el lote ${loteSeleccionado.id}.`
                  : "Mostrando los envíos individuales de todas las campañas."}
              </p>
            </div>

            {loteId && (
              <Link
                href={
                  crearUrl({
                    lote_id: null,
                    pagina_envios: "1",
                  }) + "#detalle"
                }
                className="w-fit rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Ver todos los envíos
              </Link>
            )}
          </div>

          {loteSeleccionado && (
            <div className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">
                  Fecha
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatearFecha(
                    loteSeleccionado.created_at
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">
                  Clientes
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {loteSeleccionado.total_clientes}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">
                  Aceptadas
                </p>
                <p className="mt-1 text-sm font-semibold text-green-700">
                  {loteSeleccionado.total_enviadas}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">
                  Fallidas
                </p>
                <p className="mt-1 text-sm font-semibold text-red-700">
                  {loteSeleccionado.total_fallidas}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">
                  Estado
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${claseEstadoLote(
                    loteSeleccionado.estado
                  )}`}
                >
                  {etiqueta(
                    loteSeleccionado.estado
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Total
              </p>
              <p className="text-xl font-bold text-gray-900">
                {resumenEnvios.total}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Aceptadas por Meta
              </p>
              <p className="text-xl font-bold text-blue-700">
                {resumenEnvios.aceptadas}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Enviadas por Meta
              </p>
              <p className="text-xl font-bold text-green-700">
                {resumenEnvios.enviadas}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Entregadas
              </p>
              <p className="text-xl font-bold text-blue-700">
                {resumenEnvios.entregadas}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Leídas
              </p>
              <p className="text-xl font-bold text-blue-700">
                {resumenEnvios.leidas}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Fallidas
              </p>
              <p className="text-xl font-bold text-red-700">
                {resumenEnvios.fallidas}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">
                Teléfono inválido
              </p>
              <p className="text-xl font-bold text-yellow-700">
                {resumenEnvios.telefonos_invalidos}
              </p>
            </div>
          </div>

          <form
            action="/campanas"
            className="rounded-xl border bg-white p-4 shadow-sm"
          >
            {loteId && (
              <input
                type="hidden"
                name="lote_id"
                value={loteId}
              />
            )}

            {loteSearch && (
              <input
                type="hidden"
                name="lote_search"
                value={loteSearch}
              />
            )}

            {estadoLote !== "todos" && (
              <input
                type="hidden"
                name="estado_lote"
                value={estadoLote}
              />
            )}

            {paginaLotes > 1 && (
              <input
                type="hidden"
                name="pagina_lotes"
                value={paginaLotes}
              />
            )}

            <div className="grid gap-3 xl:grid-cols-[1fr_190px_190px_190px_auto]">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Buscar cliente, teléfono, plantilla o ID..."
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              />

              <select
                name="estado"
                defaultValue={estado}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="todos">
                  Estado del envío
                </option>
                <option value="enviada_api">
                  Enviada API
                </option>
                <option value="fallida_api">
                  Fallida API
                </option>
                <option value="abierta_whatsapp">
                  Abierta WhatsApp
                </option>
              </select>

              <select
                name="estado_api"
                defaultValue={estadoApi}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="todos">
                  Estado Meta
                </option>
                <option value="accepted">
                  Accepted
                </option>
                <option value="sent">
                  Sent
                </option>
                <option value="delivered">
                  Delivered
                </option>
                <option value="read">
                  Read
                </option>
                <option value="failed">
                  Failed
                </option>
                <option value="invalid_phone">
                  Invalid phone
                </option>
              </select>

              <select
                name="canal"
                defaultValue={canal}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="todos">
                  Todos los canales
                </option>
                <option value="api_oficial">
                  API oficial
                </option>
                <option value="whatsapp_web">
                  WhatsApp Web
                </option>
              </select>

              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Filtrar envíos
              </button>
            </div>

            <div className="mt-3">
              <Link
                href={
                  crearUrl({
                    search: null,
                    estado: null,
                    estado_api: null,
                    canal: null,
                    pagina_envios: "1",
                  }) + "#detalle"
                }
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Limpiar filtros del detalle
              </Link>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Plantilla</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Meta</th>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3">
                      Fechas API
                    </th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {envios.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No hay envíos con esos filtros.
                      </td>
                    </tr>
                  ) : (
                    envios.map((envio) => (
                      <tr
                        key={envio.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {formatearFecha(
                            envio.created_at
                          )}
                        </td>

                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {envio.nombre_cliente || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {envio.telefono_cliente || "—"}
                        </td>

                        <td className="max-w-[220px] px-4 py-3 text-gray-700">
                          <p className="truncate font-medium">
                            {envio.nombre_plantilla || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {envio.lote_id ? (
                            <Link
                              href={crearHrefDetalle(
                                envio.lote_id
                              )}
                              className="block max-w-[130px] truncate text-xs font-semibold text-blue-700 hover:underline"
                              title={envio.lote_id}
                            >
                              {envio.lote_id}
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Individual
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${claseEstadoEnvio(
                              envio.estado
                            )}`}
                          >
                            {etiqueta(envio.estado)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${claseEstadoApi(
                              envio.estado_api
                            )}`}
                          >
                            {etiqueta(
                              envio.estado_api
                            )}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {etiqueta(envio.canal)}
                        </td>

                        <td className="min-w-[190px] whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                          <div>
                            Aceptado por Meta:{" "}
                            {formatearFecha(
                              envio.fecha_enviado_api
                            )}
                          </div>
                          <div>
                            Entregado:{" "}
                            {formatearFecha(
                              envio.fecha_entregado
                            )}
                          </div>
                          <div>
                            Leído:{" "}
                            {formatearFecha(
                              envio.fecha_leido
                            )}
                          </div>
                          <div>
                            Fallido:{" "}
                            {formatearFecha(
                              envio.fecha_fallido
                            )}
                          </div>
                        </td>

                        <td className="max-w-[340px] px-4 py-3 text-xs">
                          {envio.error_api ? (
                            <details>
                              <summary className="cursor-pointer font-semibold text-red-700">
                                Ver error
                              </summary>

                              <pre className="mt-2 max-w-[340px] whitespace-pre-wrap break-words rounded-lg bg-red-50 p-2 text-xs text-red-800">
                                {limpiarError(
                                  envio.error_api
                                )}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-gray-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-500">
                Mostrando {inicioEnvios} a{" "}
                {finEnvios} de {resumenEnvios.total}{" "}
                envíos. Página {paginaEnvios} de{" "}
                {totalPaginasEnvios}.
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {paginaEnvios > 1 ? (
                  <Link
                    href={
                      crearUrl({
                        pagina_envios: String(
                          paginaEnvios - 1
                        ),
                      }) + "#detalle"
                    }
                    className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border bg-gray-100 px-3 py-2 text-sm text-gray-400">
                    Anterior
                  </span>
                )}

                {obtenerPaginasVisibles(
                  paginaEnvios,
                  totalPaginasEnvios
                ).map((numeroPagina) =>
                  numeroPagina === paginaEnvios ? (
                    <span
                      key={numeroPagina}
                      aria-current="page"
                      className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {numeroPagina}
                    </span>
                  ) : (
                    <Link
                      key={numeroPagina}
                      href={
                        crearUrl({
                          pagina_envios: String(
                            numeroPagina
                          ),
                        }) + "#detalle"
                      }
                      className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      {numeroPagina}
                    </Link>
                  )
                )}

                {paginaEnvios <
                  totalPaginasEnvios ? (
                  <Link
                    href={
                      crearUrl({
                        pagina_envios: String(
                          paginaEnvios + 1
                        ),
                      }) + "#detalle"
                    }
                    className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border bg-gray-100 px-3 py-2 text-sm text-gray-400">
                    Siguiente
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Los registros anteriores a la creación del
            control por lotes pueden aparecer como
            “Individual”. Los estados de entrega, lectura y
            fallo se actualizan automáticamente mediante el
            webhook de Meta.
          </p>
        </section>
      </div>
    </main>
  );
}
