import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

const RUTAS_PUBLICAS = [
  "/login",
  "/politica-de-privacidad",
  "/terminos-y-condiciones",
  "/eliminacion-de-datos",
];

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some(
    (ruta) =>
      pathname === ruta ||
      pathname.startsWith(`${ruta}/`)
  );
}

function esWebhookMeta(pathname: string): boolean {
  return pathname === "/api/whatsapp/webhook";
}

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            }
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  /*
   * Valida el JWT y renueva la sesión
   * cuando sea necesario.
   */
  const { data, error } =
    await supabase.auth.getClaims();

  const estaAutenticado =
    !error && Boolean(data?.claims?.sub);

  const pathname = request.nextUrl.pathname;

  /*
   * Meta debe poder llamar al webhook
   * sin una sesión del CRM.
   */
  if (esWebhookMeta(pathname)) {
    return supabaseResponse;
  }

  /*
   * El login y las páginas legales
   * permanecen públicas.
   */
  if (esRutaPublica(pathname)) {
    if (
      pathname === "/login" &&
      estaAutenticado
    ) {
      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }

    return supabaseResponse;
  }

  /*
   * Las APIs protegidas responden JSON,
   * no una redirección HTML.
   */
  if (
    pathname.startsWith("/api/") &&
    !estaAutenticado
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "No autorizado.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * Las páginas privadas redirigen
   * al formulario de inicio de sesión.
   */
  if (!estaAutenticado) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  return supabaseResponse;
}