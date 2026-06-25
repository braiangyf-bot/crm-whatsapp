import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const id = String(body.id || "").trim();
    const cedulaOriginal = String(body.cedula || "").trim();
    const nombre = String(body.nombre || "").trim();
    const telefonoOriginal = String(body.telefono || "").trim();
    const estado = String(body.estado || "pendiente").trim();
    const notas = String(body.notas || "").trim();

    const cedula = cedulaOriginal.replace(/\D/g, "");
    const telefono = telefonoOriginal.replace(/\D/g, "");

    if (!id || !cedula || !nombre || !telefono) {
      return NextResponse.json(
        { error: "La cédula, el nombre y el teléfono son obligatorios." },
        { status: 400 }
      );
    }

    if (cedulaOriginal !== cedula || telefonoOriginal !== telefono) {
      return NextResponse.json(
        { error: "La cédula y el teléfono solo deben contener números." },
        { status: 400 }
      );
    }

    const clienteExistente = await prisma.clientes.findUnique({
      where: { id },
    });

    if (!clienteExistente) {
      return NextResponse.json(
        { error: "El cliente no existe." },
        { status: 404 }
      );
    }

    const duplicados = await prisma.clientes.findMany({
      where: {
        id: {
          not: id,
        },
        OR: [{ cedula }, { telefono }],
      },
      select: {
        cedula: true,
        telefono: true,
      },
    });

    const cedulaDuplicada = duplicados.some(
      (cliente) => cliente.cedula === cedula
    );

    const telefonoDuplicado = duplicados.some(
      (cliente) => cliente.telefono === telefono
    );

    if (cedulaDuplicada && telefonoDuplicado) {
      return NextResponse.json(
        {
          error:
            "Ya existe otro cliente registrado con esa cédula y ese teléfono.",
        },
        { status: 400 }
      );
    }

    if (cedulaDuplicada) {
      return NextResponse.json(
        { error: "Ya existe otro cliente registrado con esa cédula." },
        { status: 400 }
      );
    }

    if (telefonoDuplicado) {
      return NextResponse.json(
        { error: "Ya existe otro cliente registrado con ese teléfono." },
        { status: 400 }
      );
    }

    const cliente = await prisma.clientes.update({
      where: { id },
      data: {
        cedula,
        nombre,
        telefono,
        estado,
        notas,
      },
    });

    return NextResponse.json(cliente);
  } catch (error) {
    console.error("Error editando cliente:", error);

    return NextResponse.json(
      { error: "Error editando cliente" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Falta el ID del cliente." },
        { status: 400 }
      );
    }

    await prisma.clientes.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando cliente:", error);

    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
}