import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, { params }: Params) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const titulo = String(body.titulo ?? "").trim();
    const contenido = String(body.contenido ?? "").trim();
    const activa = Boolean(body.activa ?? true);

    if (!titulo) {
      return NextResponse.json(
        { ok: false, error: "El título es obligatorio." },
        { status: 400 }
      );
    }

    if (!contenido) {
      return NextResponse.json(
        { ok: false, error: "El contenido es obligatorio." },
        { status: 400 }
      );
    }

    const respuesta = await prisma.respuestas_rapidas.update({
      where: {
        id,
      },
      data: {
        titulo,
        contenido,
        activa,
      },
    });

    return NextResponse.json({
      ok: true,
      respuesta,
    });
  } catch (error) {
    console.error("Error editando respuesta rápida:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno editando respuesta rápida.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const { id } = await params;

    await prisma.respuestas_rapidas.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje: "Respuesta rápida eliminada.",
    });
  } catch (error) {
    console.error("Error eliminando respuesta rápida:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno eliminando respuesta rápida.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}