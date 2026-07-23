import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_SOLICITUD = 50;
const DIAS_BLOQUEO_REENVIO = 7;

function normalizarTelefonoColombia(
  telefono: string | null | undefined,
): string | null {
  const limpio = String(telefono ?? "").replace(/\D/g, "");

  if (limpio.length === 10 && limpio.startsWith("3")) {
    return `57${limpio}`;
  }

  if (limpio.length === 12 && limpio.startsWith("57")) {
    return limpio;
  }

  return null;
}

function calcularFechaLimiteDuplicados(): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - DIAS_BLOQUEO_REENVIO);
  return fecha;
}

export async function POST(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "El cuerpo de la solicitud no es válido.",
        },
        { status: 400 },
      );
    }

    const datos = body as Record<string, unknown>;

    const clienteIdsRecibidos: string[] = Array.isArray(
      datos.cliente_ids,
    )
      ? datos.cliente_ids
          .map((id: unknown): string => String(id ?? "").trim())
          .filter((id: string): boolean => id.length > 0)
      : [];

    const clienteIds = Array.from(new Set(clienteIdsRecibidos));

    const templateName = String(
      datos.meta_template_name ?? "",
    ).trim();

    const templateLanguage = String(
      datos.meta_template_language ?? "es",
    ).trim();

    const variableCount = Number(
      datos.meta_variable_count ?? 0,
    );

    if (clienteIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Debes seleccionar al menos un cliente.",
        },
        { status: 400 },
      );
    }

    if (clienteIds.length > LIMITE_SOLICITUD) {
      return NextResponse.json(
        {
          ok: false,
          error: `Solo se permiten máximo ${LIMITE_SOLICITUD} clientes por campaña.`,
        },
        { status: 400 },
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta meta_template_name.",
        },
        { status: 400 },
      );
    }

    if (!templateLanguage) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta meta_template_language.",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(variableCount) ||
      ![0, 1].includes(variableCount)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo se permiten plantillas con 0 o 1 variable.",
        },
        { status: 400 },
      );
    }

    const clientes = await prisma.clientes.findMany({
      where: {
        id: {
          in: clienteIds,
        },
      },
      select: {
        id: true,
        nombre: true,
        telefono: true,
        estado: true,
      },
    });

    const idsEncontrados = new Set(
      clientes.map((cliente) => cliente.id),
    );

    const idsNoEncontrados = clienteIds.filter(
      (id) => !idsEncontrados.has(id),
    );

    const clientesNoResponde = clientes.filter(
      (cliente) => cliente.estado === "no_responde",
    );

    const clientesElegiblesPorEstado = clientes.filter(
      (cliente) => cliente.estado !== "no_responde",
    );

    const fechaLimiteDuplicados = calcularFechaLimiteDuplicados();

    const campanasRecientes =
      await prisma.campanas_enviadas.findMany({
        where: {
          cliente_id: {
            in: clientesElegiblesPorEstado.map(
              (cliente) => cliente.id,
            ),
          },
          nombre_plantilla: templateName,
          estado: {
            not: "fallida_api",
          },
          OR: [
            {
              fecha_enviado_api: {
                gte: fechaLimiteDuplicados,
              },
            },
            {
              created_at: {
                gte: fechaLimiteDuplicados,
              },
            },
          ],
        },
        select: {
          cliente_id: true,
        },
      });

    const clientesConCampanaReciente = new Set(
      campanasRecientes.map((campana) => campana.cliente_id),
    );

    const clientesDuplicados = clientesElegiblesPorEstado.filter(
      (cliente) => clientesConCampanaReciente.has(cliente.id),
    );

    const clientesSinDuplicado = clientesElegiblesPorEstado.filter(
      (cliente) => !clientesConCampanaReciente.has(cliente.id),
    );

    const clientesTelefonoInvalido = clientesSinDuplicado.filter(
      (cliente) => !normalizarTelefonoColombia(cliente.telefono),
    );

    const clientesEnviables = clientesSinDuplicado.filter(
      (cliente) => normalizarTelefonoColombia(cliente.telefono),
    );

    const clientesOmitidos = [
      ...idsNoEncontrados.map((clienteId) => ({
        cliente_id: clienteId,
        codigo: "client_not_found",
        motivo: "Cliente no encontrado.",
      })),

      ...clientesNoResponde.map((cliente) => ({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        estado: cliente.estado,
        codigo: "cliente_no_responde",
        motivo:
          "Cliente omitido porque está marcado como No responde.",
      })),

      ...clientesDuplicados.map((cliente) => ({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        estado: cliente.estado,
        codigo: "campana_duplicada_reciente",
        motivo: `Ya recibió la plantilla "${templateName}" en los últimos ${DIAS_BLOQUEO_REENVIO} días.`,
      })),

      ...clientesTelefonoInvalido.map((cliente) => ({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        estado: cliente.estado,
        codigo: "invalid_phone",
        motivo:
          "Teléfono inválido. Debe ser un celular colombiano válido.",
      })),
    ];

    return NextResponse.json({
      ok: true,
      plantilla: {
        nombre: templateName,
        idioma: templateLanguage,
        variables: variableCount,
      },
      total_seleccionados: clienteIds.length,
      total_encontrados: clientes.length,
      total_enviables: clientesEnviables.length,
      total_omitidos: clientesOmitidos.length,
      omitidos_no_encontrados: idsNoEncontrados.length,
      omitidos_no_responde: clientesNoResponde.length,
      omitidos_duplicados: clientesDuplicados.length,
      omitidos_telefono_invalido: clientesTelefonoInvalido.length,
      clientes_enviables: clientesEnviables.map((cliente) => ({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        estado: cliente.estado,
      })),
      clientes_omitidos: clientesOmitidos,
    });
  } catch (error) {
    console.error("Error en vista previa de campaña:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno generando vista previa de campaña.",
        detalle:
          error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}