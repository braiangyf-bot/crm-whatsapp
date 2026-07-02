import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const { id, estado } = await request.json();

    console.log("ACTUALIZANDO CLIENTE:", {
      id,
      estado,
    });

    if (!id || !estado) {
      return NextResponse.json(
        {
          error: "Faltan id o estado",
        },
        {
          status: 400,
        }
      );
    }

    const clienteActualizado =
      await prisma.clientes.update({
        where: {
          id,
        },
        data: {
          estado,
          ultimo_contacto: new Date(),
        },
      });

    console.log(
      "CLIENTE ACTUALIZADO:",
      clienteActualizado
    );

    return NextResponse.json({
      ok: true,
      cliente: clienteActualizado,
    });
  } catch (error) {
    console.error(
      "ERROR ACTUALIZANDO ESTADO:",
      error
    );

    return NextResponse.json(
      {
        error: "Error actualizando estado",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const { id } = await request.json();

    console.log("ELIMINANDO CLIENTE:", {
      id,
    });

    if (!id) {
      return NextResponse.json(
        {
          error: "Falta el ID del cliente",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.clientes.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "ERROR ELIMINANDO CLIENTE:",
      error
    );

    return NextResponse.json(
      {
        error: "Error al eliminar cliente",
      },
      {
        status: 500,
      }
    );
  }
}