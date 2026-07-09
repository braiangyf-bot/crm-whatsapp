import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Ejecutar el proxy en rutas privadas de la app,
     * excluyendo archivos públicos, PWA, páginas legales
     * y el webhook público de WhatsApp.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|api/whatsapp/webhook|eliminacion-de-datos|terminos-y-condiciones|politica-de-privacidad|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};