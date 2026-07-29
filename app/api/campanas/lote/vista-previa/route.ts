import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_SOLICITUD = 50;


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


function normalizarVariablesBody(valor: unknown): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.map((item) => String(item ?? "").trim());
}

function validarVariablesBody({
  variableCount,
  valoresBase,
}: {
  variableCount: number;
  valoresBase: string[];
}): string | null {
  if (variableCount <= 1) {
    return null;
  }

  for (let indice = 1; indice < variableCount; indice += 1) {
    const valor = valoresBase[indice]?.trim();

    if (!valor) {
      return `Falta el valor para la variable {{${indice + 1}}}.`;
    }
  }

  return null;
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

    const bodyVariablesBase = normalizarVariablesBody(
      datos.meta_body_variables,
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
      variableCount < 0 ||
      variableCount > 20
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo se permiten plantillas entre 0 y 20 variables.",
        },
        { status: 400 },
      );
    }

    const errorVariablesBody = validarVariablesBody({
      variableCount,
      valoresBase: bodyVariablesBase,
    });

    if (errorVariablesBody) {
      return NextResponse.json(
        {
          ok: false,
          error: errorVariablesBody,
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

    const clientesTelefonoInvalido = clientesElegiblesPorEstado.filter(
      (cliente) => !normalizarTelefonoColombia(cliente.telefono),
    );

    const clientesEnviables = clientesElegiblesPorEstado.filter(
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
        variables_body: bodyVariablesBase,
      },
      total_seleccionados: clienteIds.length,
      total_encontrados: clientes.length,
      total_enviables: clientesEnviables.length,
      total_omitidos: clientesOmitidos.length,
      omitidos_no_encontrados: idsNoEncontrados.length,
      omitidos_no_responde: clientesNoResponde.length,
      omitidos_duplicados: 0,
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