import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const { id, estado } = await request.json();

    console.log("ACTUALIZANDO CLIENTE:", { id, estado });

    if (!id || !estado) {
      return NextResponse.json(
        { error: "Faltan id o estado" },
        { status: 400 }
      );
    }

    const clienteActualizado = await prisma.clientes.update({
      where: { id },
      data: { estado },
    });

    console.log("CLIENTE ACTUALIZADO:", clienteActualizado);

    return NextResponse.json({ ok: true, cliente: clienteActualizado });
  } catch (error) {
    console.error("ERROR ACTUALIZANDO ESTADO:", error);

    return NextResponse.json(
      { error: "Error actualizando estado" },
      { status: 500 }
    );
  }
}