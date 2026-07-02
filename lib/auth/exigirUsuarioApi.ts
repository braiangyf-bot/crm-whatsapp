import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AutenticacionCorrecta = {
  ok: true;
  usuario: User;
};

type AutenticacionFallida = {
  ok: false;
  response: NextResponse;
};

type ResultadoAutenticacion =
  | AutenticacionCorrecta
  | AutenticacionFallida;

export async function exigirUsuarioApi(): Promise<ResultadoAutenticacion> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "No autorizado.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      ),
    };
  }

  return {
    ok: true,
    usuario: user,
  };
}