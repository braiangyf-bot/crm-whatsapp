import { NextResponse } from "next/server";

import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";

const ESTADOS_CLIENTE_PERMITIDOS = [
  "pendiente",
  "contactado",
  "interesado",
  "cliente",
  "no_responde",
] as const;

type EstadoCliente = (typeof ESTADOS_CLIENTE_PERMITIDOS)[number];

function soloNumeros(valor: string | null | undefined): string {
  return String(valor ?? "").replace(/\D/g, "");
}

function normalizarTelefonoParaCrm(telefono: string | null): string | null {
  const limpio = soloNumeros(telefono);

  if (limpio.length === 12 && limpio.startsWith("57")) {
    return limpio.slice(2);
  }

  if (limpio.length === 10 && limpio.startsWith("3")) {
    return limpio;
  }

  return null;
}

function crearTelefonosPosibles(telefono: string): string[] {
  const limpio = soloNumeros(telefono);

  if (!limpio) {
    return [];
  }

  const sinCodigoColombia =
    limpio.startsWith("57") && limpio.length > 10
      ? limpio.slice(2)
      : limpio;

  return Array.from(
    new Set([
      limpio,
      sinCodigoColombia,
      `57${sinCodigoColombia}`,
      `+57${sinCodigoColombia}`,
    ]),
  );
}

function esEstadoCliente(valor: string): valor is EstadoCliente {
  return ESTADOS_CLIENTE_PERMITIDOS.includes(valor as EstadoCliente);
}

export async function POST(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      conversacion_id?: unknown;
      nombre?: unknown;
      cedula?: unknown;
      estado?: unknown;
      notas?: unknown;
    } | null;

    const conversacionId = String(body?.conversacion_id ?? "").trim();
    const nombreFormulario = String(body?.nombre ?? "").trim();
    const cedulaFormulario = soloNumeros(String(body?.cedula ?? ""));
    const estadoFormulario = String(body?.estado ?? "pendiente").trim();
    const notas = String(body?.notas ?? "").trim();

    const estado: EstadoCliente = esEstadoCliente(estadoFormulario)
      ? estadoFormulario
      : "pendiente";

    if (!conversacionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta el ID de la conversación.",
        },
        { status: 400 },
      );
    }

    const conversacion =
      await prisma.conversaciones_whatsapp.findUnique({
        where: {
          id: conversacionId,
        },
        select: {
          id: true,
          cliente_id: true,
          telefono_cliente: true,
          nombre_cliente: true,
        },
      });

    if (!conversacion) {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no existe.",
        },
        { status: 404 },
      );
    }

    if (conversacion.cliente_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Esta conversación ya está vinculada a un cliente.",
        },
        { status: 409 },
      );
    }

    const telefonoCrm = normalizarTelefonoParaCrm(
      conversacion.telefono_cliente,
    );

    if (!telefonoCrm) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo normalizar el teléfono de la conversación como celular colombiano.",
        },
        { status: 400 },
      );
    }

    const telefonosPosibles = crearTelefonosPosibles(
      conversacion.telefono_cliente,
    );

    const clientePorTelefono = await prisma.clientes.findFirst({
      where: {
        telefono: {
          in: telefonosPosibles,
        },
      },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        estado: true,
      },
    });

    if (clientePorTelefono) {
      await prisma.conversaciones_whatsapp.update({
        where: {
          id: conversacion.id,
        },
        data: {
          cliente_id: clientePorTelefono.id,
          nombre_cliente: clientePorTelefono.nombre,
        },
      });

      return NextResponse.json({
        ok: true,
        creado: false,
        vinculado: true,
        mensaje:
          "Ya existía un cliente con este teléfono. Se vinculó la conversación.",
        cliente: clientePorTelefono,
      });
    }

    const cedula = cedulaFormulario || telefonoCrm;

    const clientePorCedula = await prisma.clientes.findUnique({
      where: {
        cedula,
      },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
      },
    });

    if (clientePorCedula) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ya existe un cliente con esa cédula. Edita la cédula o busca el cliente existente.",
          cliente: clientePorCedula,
        },
        { status: 409 },
      );
    }

    const nombre =
      nombreFormulario ||
      conversacion.nombre_cliente?.trim() ||
      `Cliente ${telefonoCrm}`;

    const clienteCreado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.clientes.create({
        data: {
          cedula,
          nombre,
          telefono: telefonoCrm,
          estado,
          notas: notas || null,
        },
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          estado: true,
          notas: true,
        },
      });

      await tx.conversaciones_whatsapp.update({
        where: {
          id: conversacion.id,
        },
        data: {
          cliente_id: cliente.id,
          nombre_cliente: cliente.nombre,
        },
      });

      return cliente;
    });

    return NextResponse.json({
      ok: true,
      creado: true,
      vinculado: true,
      mensaje: "Cliente creado y conversación vinculada correctamente.",
      cliente: clienteCreado,
    });
  } catch (error) {
    console.error("Error creando cliente desde conversación:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo crear el cliente desde la conversación.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}