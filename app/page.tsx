import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import EstadoSelect from "@/app/components/EstadoSelect";
import LimpiarBusqueda from "@/app/components/LimpiarBusqueda";

export const dynamic = "force-dynamic";

type Cliente = {
  id: string;
  created_at: Date;
  nombre: string;
  telefono: string;
  estado: string | null;
};

async function crearCliente(formData: FormData) {
  "use server";

  const nombre = String(formData.get("nombre") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const estado = String(formData.get("estado") || "pendiente");

  if (!nombre || !telefono) return;

  await prisma.clientes.create({
    data: {
      nombre,
      telefono,
      estado,
    },
  });

  revalidatePath("/");
}



export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const search = (params.search || "").trim();

  const palabras = search
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);

  const clientes: Cliente[] = search
    ? await prisma.$queryRaw<Cliente[]>`
        SELECT id, created_at, nombre, telefono, estado
        FROM clientes
        WHERE 
          telefono ILIKE ${`%${search}%`}
          OR EXISTS (
            SELECT 1
            FROM unnest(${palabras}::text[]) AS palabra
            WHERE nombre ILIKE '%' || palabra || '%'
          )
        ORDER BY created_at DESC
      `
    : await prisma.clientes.findMany({
        orderBy: { created_at: "desc" },
      });

  const todosLosClientes: Cliente[] = await prisma.clientes.findMany();

const pendientes = todosLosClientes.filter((c: Cliente) => c.estado === "pendiente").length;
const contactados = todosLosClientes.filter((c: Cliente) => c.estado === "contactado").length;
const interesados = todosLosClientes.filter((c: Cliente) => c.estado === "interesado").length;
const clientesActivos = todosLosClientes.filter((c: Cliente) => c.estado === "cliente").length;
const noResponde = todosLosClientes.filter((c: Cliente) => c.estado === "no_responde").length;
  return (
    <main className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">CRM WhatsApp</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="border rounded p-4 bg-yellow-50">
          <h2 className="font-bold">Pendientes</h2>
          <p className="text-3xl">{pendientes}</p>
        </div>

        <div className="border rounded p-4 bg-blue-50">
          <h2 className="font-bold">Contactados</h2>
          <p className="text-3xl">{contactados}</p>
        </div>

        <div className="border rounded p-4 bg-green-50">
          <h2 className="font-bold">Interesados</h2>
          <p className="text-3xl">{interesados}</p>
        </div>

        <div className="border rounded p-4 bg-purple-50">
          <h2 className="font-bold">Clientes</h2>
          <p className="text-3xl">{clientesActivos}</p>
        </div>

        <div className="border rounded p-4 bg-red-50">
          <h2 className="font-bold">No responde</h2>
          <p className="text-3xl">{noResponde}</p>
        </div>
      </div>

      <form action={crearCliente} className="flex flex-col md:flex-row gap-2 mb-8">
        <input
          name="nombre"
          placeholder="Nombre"
          className="border p-2 rounded"
          required
        />

        <input
          name="telefono"
          placeholder="Teléfono"
          className="border p-2 rounded"
          required
        />

        <select name="estado" className="border p-2 rounded" defaultValue="pendiente">
          <option value="pendiente">Pendiente</option>
          <option value="contactado">Contactado</option>
          <option value="interesado">Interesado</option>
          <option value="cliente">Cliente</option>
          <option value="no_responde">No responde</option>
        </select>

        <button type="submit" className="bg-black text-white px-4 py-2 rounded">
          Guardar
        </button>
      </form>

      <form className="mb-6 flex gap-2">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Buscar por nombre o teléfono..."
          className="border p-3 rounded flex-1"
        />

        <button type="submit" className="bg-blue-600 text-white px-4 rounded">
          Buscar
        </button>

        {search && <LimpiarBusqueda />}
      </form>

      <p className="mb-4 font-semibold">
        Total clientes encontrados: {clientes.length}
      </p>

      <div className="overflow-x-auto">
        <table className="border-collapse border w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-3 text-left">Nombre</th>
              <th className="border p-3 text-left">Teléfono</th>
              <th className="border p-3 text-left">Estado</th>
            </tr>
          </thead>

          <tbody>
  {clientes.map((cliente) => (
    <tr key={cliente.id}>
      <td className="border p-3">{cliente.nombre}</td>

      <td className="border p-3">{cliente.telefono}</td>

      <td className="border p-3">
        <EstadoSelect
  clienteId={cliente.id}
  estadoActual={cliente.estado || "pendiente"}
/>
      </td>
    </tr>
  ))}
</tbody>
        </table>
      </div>
    </main>
  );
}