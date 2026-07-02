import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function exigirUsuarioPagina() {
  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.getClaims();

  const usuarioId = data?.claims?.sub;

  if (error || !usuarioId) {
    redirect("/login");
  }

  return data.claims;
}