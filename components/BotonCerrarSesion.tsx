import { cerrarSesion } from "@/app/auth/actions";

export default function BotonCerrarSesion() {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
      >
        Cerrar sesión
      </button>
    </form>
  );
}