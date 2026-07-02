"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function iniciarSesion(
  formData: FormData
) {
  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    formData.get("password") ?? ""
  );

  if (!email || !password) {
    const mensaje = encodeURIComponent(
      "Completa el correo y la contraseña."
    );

    redirect(`/login?error=${mensaje}`);
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    const mensaje = encodeURIComponent(
      "Correo o contraseña incorrectos."
    );

    redirect(`/login?error=${mensaje}`);
  }

  redirect("/");
}