import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const respuestas = await prisma.respuestas_rapidas.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({
      ok: true,
      respuestas,
    });
  } catch (error) {
    console.error("Error listando respuestas rápidas:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno listando respuestas rápidas.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  try {
    const body = await request.json();

    const titulo = String(body.titulo ?? "").trim();
    const contenido = String(body.contenido ?? "").trim();

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

    const respuesta = await prisma.respuestas_rapidas.create({
      data: {
        titulo,
        contenido,
        activa: true,
      },
    });

    return NextResponse.json({
      ok: true,
      respuesta,
    });
  } catch (error) {
    console.error("Error creando respuesta rápida:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno creando respuesta rápida.",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}