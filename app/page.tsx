import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import LimpiarBusqueda from "@/app/components/LimpiarBusqueda";
import TablaClientes from "@/app/components/TablaClientes";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CLIENTES_POR_PAGINA = 50;

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

type ResumenClientes = {
  total: number;
};

type ResumenEstados = {
  pendientes: number;
  contactados: number;
  interesados: number;
  clientes_activos: number;
  no_responde: number;
};

async function crearCliente(formData: FormData) {
  "use server";

  const cedulaOriginal = String(formData.get("cedula") || "").trim();
  const nombre = String(formData.get("nombre") || "").trim();
  const telefonoOriginal = String(formData.get("telefono") || "").trim();
  const estado = String(formData.get("estado") || "pendiente");

  const cedula = cedulaOriginal.replace(/\D/g, "");
  const telefono = telefonoOriginal.replace(/\D/g, "");

  if (!cedula || !nombre || !telefono) return;

  if (cedulaOriginal !== cedula || telefonoOriginal !== telefono) {
    redirect("/?error=solo_numeros");
  }

  const clientesExistentes = await prisma.clientes.findMany({
    where: {
      OR: [{ cedula }, { telefono }],
    },
    select: {
      cedula: true,
      telefono: true,
    },
  });

  const cedulaDuplicada = clientesExistentes.some(
    (cliente) => cliente.cedula === cedula
  );

  const telefonoDuplicado = clientesExistentes.some(
    (cliente) => cliente.telefono === telefono
  );

  if (cedulaDuplicada && telefonoDuplicado) {
    redirect(
      `/?error=cedula_telefono_duplicados&cedula=${encodeURIComponent(
        cedula
      )}&telefono=${encodeURIComponent(telefono)}`
    );
  }

  if (cedulaDuplicada) {
    redirect(`/?error=cedula_duplicada&cedula=${encodeURIComponent(cedula)}`);
  }

  if (telefonoDuplicado) {
    redirect(
      `/?error=telefono_duplicado&telefono=${encodeURIComponent(telefono)}`
    );
  }

  await prisma.clientes.create({
    data: {
      cedula,
      nombre,
      telefono,
      estado,
    },
  });

  revalidatePath("/");
}

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

function claseFiltro(activo: boolean, activoClase: string, inactivoClase: string) {
  return `inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition ${activo ? activoClase : inactivoClase}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    estado?: string;
    edicion?: string;
    error?: string;
    cedula?: string;
    telefono?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;

  const search = (params.search || "").trim();
  const estadoFiltro = params.estado || "todos";
  const edicionFiltro = params.edicion || "todos";
  const paginaSolicitada = obtenerPagina(params.pagina);

  const palabras = search
    .split(/\s+/)
    .map((palabra) => palabra.trim())
    .filter(Boolean);

  const whereClientes = Prisma.sql`
    WHERE
      (
        ${search} = ''
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(${palabras}::text[]) AS palabra
          WHERE NOT (
            COALESCE(nombre, '') ILIKE '%' || palabra || '%'
            OR COALESCE(cedula, '') ILIKE '%' || palabra || '%'
            OR COALESCE(telefono, '') ILIKE '%' || palabra || '%'
          )
        )
      )
      AND (
        ${estadoFiltro} = 'todos'
        OR estado = ${estadoFiltro}
      )
      AND (
        ${edicionFiltro} = 'todos'
        OR (
          ${edicionFiltro} = 'sin_editar'
          AND ultimo_contacto IS NULL
        )
        OR (
          ${edicionFiltro} = 'mas_7'
          AND ultimo_contacto <= NOW() - INTERVAL '7 days'
        )
        OR (
          ${edicionFiltro} = 'mas_15'
          AND ultimo_contacto <= NOW() - INTERVAL '15 days'
        )
        OR (
          ${edicionFiltro} = 'mas_30'
          AND ultimo_contacto <= NOW() - INTERVAL '30 days'
        )
      )
  `;

  const resumenClientesResultado =
    await prisma.$queryRaw<ResumenClientes[]>`
      SELECT COUNT(*)::int AS total
      FROM clientes
      ${whereClientes}
    `;

  const totalClientesEncontrados =
    resumenClientesResultado[0]?.total || 0;

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      totalClientesEncontrados / CLIENTES_POR_PAGINA
    )
  );

  const paginaActual = Math.min(
    paginaSolicitada,
    totalPaginas
  );

  const offset =
    (paginaActual - 1) * CLIENTES_POR_PAGINA;

  const inicioClientes =
    totalClientesEncontrados === 0 ? 0 : offset + 1;

  const finClientes = Math.min(
    offset + CLIENTES_POR_PAGINA,
    totalClientesEncontrados
  );

  const clientes: Cliente[] =
    await prisma.$queryRaw<Cliente[]>`
      SELECT
        id::text AS id,
        created_at,
        cedula,
        nombre,
        telefono,
        estado,
        ultimo_contacto,
        notas
      FROM clientes
      ${whereClientes}
      ORDER BY created_at DESC, id DESC
      LIMIT ${CLIENTES_POR_PAGINA}
      OFFSET ${offset}
    `;

  const resumenEstadosResultado =
    await prisma.$queryRaw<ResumenEstados[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE estado = 'pendiente'
        )::int AS pendientes,

        COUNT(*) FILTER (
          WHERE estado = 'contactado'
        )::int AS contactados,

        COUNT(*) FILTER (
          WHERE estado = 'interesado'
        )::int AS interesados,

        COUNT(*) FILTER (
          WHERE estado = 'cliente'
        )::int AS clientes_activos,

        COUNT(*) FILTER (
          WHERE estado = 'no_responde'
        )::int AS no_responde

      FROM clientes
    `;

  const resumenEstados =
    resumenEstadosResultado[0] || {
      pendientes: 0,
      contactados: 0,
      interesados: 0,
      clientes_activos: 0,
      no_responde: 0,
    };

  const pendientes = resumenEstados.pendientes;
  const contactados = resumenEstados.contactados;
  const interesados = resumenEstados.interesados;
  const clientesActivos =
    resumenEstados.clientes_activos;
  const noResponde = resumenEstados.no_responde;

  function crearUrlPagina(numeroPagina: number): string {
    const query = new URLSearchParams();

    if (search) {
      query.set("search", search);
    }

    if (estadoFiltro !== "todos") {
      query.set("estado", estadoFiltro);
    }

    if (edicionFiltro !== "todos") {
      query.set("edicion", edicionFiltro);
    }

    if (numeroPagina > 1) {
      query.set("pagina", String(numeroPagina));
    }

    const queryString = query.toString();

    return queryString ? `/?${queryString}` : "/";
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            CRM Bienestar Al Natural
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión de clientes, seguimiento comercial y campañas por WhatsApp API.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/importar-clientes"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Importar clientes
          </Link>

          <Link
            href="/campanas"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            Ver campañas enviadas
          </Link>
        </div>

      </div>

      {params.error === "solo_numeros" && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
          La cédula y el teléfono solo deben contener números.
        </div>
      )}

      {params.error === "cedula_duplicada" && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Ya existe un cliente registrado con la cédula {params.cedula}.
        </div>
      )}

      {params.error === "telefono_duplicado" && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Ya existe un cliente registrado con el teléfono {params.telefono}.
        </div>
      )}

      {params.error === "cedula_telefono_duplicados" && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Ya existe un cliente registrado con la cédula {params.cedula} y el
          teléfono {params.telefono}.
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-yellow-800">Pendientes</h2>
          <p className="mt-2 text-3xl font-bold text-yellow-900">{pendientes}</p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-blue-800">Contactados</h2>
          <p className="mt-2 text-3xl font-bold text-blue-900">{contactados}</p>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-purple-800">Interesados</h2>
          <p className="mt-2 text-3xl font-bold text-purple-900">{interesados}</p>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-green-800">Clientes</h2>
          <p className="mt-2 text-3xl font-bold text-green-900">
            {clientesActivos}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-red-800">No responde</h2>
          <p className="mt-2 text-3xl font-bold text-red-900">{noResponde}</p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Nuevo cliente</h2>

        <form action={crearCliente} className="grid gap-3 md:grid-cols-5">
          <input
            name="cedula"
            placeholder="Cédula"
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-black"
            inputMode="numeric"
            pattern="[0-9]+"
            title="La cédula solo debe contener números"
            required
          />

          <input
            name="nombre"
            placeholder="Nombre"
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-black"
            required
          />

          <input
            name="telefono"
            placeholder="Teléfono"
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-black"
            inputMode="numeric"
            pattern="[0-9]+"
            title="El teléfono solo debe contener números"
            required
          />

          <select
            name="estado"
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-black"
            defaultValue="pendiente"
          >
            <option value="pendiente">Pendiente</option>
            <option value="contactado">Contactado</option>
            <option value="interesado">Interesado</option>
            <option value="cliente">Cliente</option>
            <option value="no_responde">No responde</option>
          </select>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Guardar cliente
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Buscar por nombre, cédula o teléfono..."
            className="h-11 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-black"
          />

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Buscar
          </button>

          {search && <LimpiarBusqueda />}
        </form>

        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href={`/?search=${encodeURIComponent(search)}&estado=todos&edicion=${edicionFiltro}`}
            className={claseFiltro(
              estadoFiltro === "todos",
              "bg-black text-white",
              "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Todos
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=pendiente&edicion=${edicionFiltro}`}
            className={claseFiltro(
              estadoFiltro === "pendiente",
              "bg-yellow-500 text-white",
              "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            )}
          >
            Pendientes
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=contactado&edicion=${edicionFiltro}`}
            className={claseFiltro(
              estadoFiltro === "contactado",
              "bg-blue-600 text-white",
              "bg-blue-100 text-blue-800 hover:bg-blue-200"
            )}
          >
            Contactados
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=interesado&edicion=${edicionFiltro}`}
            className={claseFiltro(
              estadoFiltro === "interesado",
              "bg-purple-600 text-white",
              "bg-purple-100 text-purple-800 hover:bg-purple-200"
            )}
          >
            Interesados
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=cliente&edicion=${edicionFiltro}`}
            className={claseFiltro(
              estadoFiltro === "cliente",
              "bg-green-600 text-white",
              "bg-green-100 text-green-800 hover:bg-green-200"
            )}
          >
            Clientes
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=no_responde&edicion=${edicionFiltro}`}
            className={claseFiltro(
              estadoFiltro === "no_responde",
              "bg-red-600 text-white",
              "bg-red-100 text-red-800 hover:bg-red-200"
            )}
          >
            No responde
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/?search=${encodeURIComponent(search)}&estado=${estadoFiltro}&edicion=todos`}
            className={claseFiltro(
              edicionFiltro === "todos",
              "bg-black text-white",
              "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Todas las ediciones
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=${estadoFiltro}&edicion=sin_editar`}
            className={claseFiltro(
              edicionFiltro === "sin_editar",
              "bg-orange-600 text-white",
              "bg-orange-100 text-orange-800 hover:bg-orange-200"
            )}
          >
            Sin editar
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=${estadoFiltro}&edicion=mas_7`}
            className={claseFiltro(
              edicionFiltro === "mas_7",
              "bg-amber-600 text-white",
              "bg-amber-100 text-amber-800 hover:bg-amber-200"
            )}
          >
            +7 días
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=${estadoFiltro}&edicion=mas_15`}
            className={claseFiltro(
              edicionFiltro === "mas_15",
              "bg-orange-700 text-white",
              "bg-orange-100 text-orange-800 hover:bg-orange-200"
            )}
          >
            +15 días
          </a>

          <a
            href={`/?search=${encodeURIComponent(search)}&estado=${estadoFiltro}&edicion=mas_30`}
            className={claseFiltro(
              edicionFiltro === "mas_30",
              "bg-red-700 text-white",
              "bg-red-100 text-red-800 hover:bg-red-200"
            )}
          >
            +30 días
          </a>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-gray-800">
          Total clientes encontrados:{" "}
          {totalClientesEncontrados}
        </p>

        <p className="text-sm text-gray-500">
          Mostrando {inicioClientes} a {finClientes} de{" "}
          {totalClientesEncontrados}
        </p>
      </div>

      <TablaClientes
        key={`${paginaActual}-${search}-${estadoFiltro}-${edicionFiltro}`}
        clientes={clientes}
      />

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500">
          Página {paginaActual} de {totalPaginas}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {paginaActual > 1 ? (
            <Link
              href={crearUrlPagina(paginaActual - 1)}
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
            paginaActual,
            totalPaginas
          ).map((numeroPagina) =>
            numeroPagina === paginaActual ? (
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
                href={crearUrlPagina(numeroPagina)}
                className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                {numeroPagina}
              </Link>
            )
          )}

          {paginaActual < totalPaginas ? (
            <Link
              href={crearUrlPagina(paginaActual + 1)}
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
    </main>
  );
}