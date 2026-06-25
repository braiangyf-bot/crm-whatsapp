import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const { id, notas } = await request.json();

    if (!id || notas === undefined) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    const clienteActualizado = await prisma.clientes.update({
      where: { id },
      data: {
        notas,
      },
    });

    return NextResponse.json({
      ok: true,
      cliente: clienteActualizado,
    });
  } catch (error) {
    console.error("ERROR GUARDANDO NOTAS:", error);

    return NextResponse.json(
      { error: "Error guardando notas" },
      { status: 500 }
    );
  }
}