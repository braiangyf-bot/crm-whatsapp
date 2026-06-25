import type { Metadata } from "next";

export const metadata: Metadata = {
title: "Términos y condiciones | Bienestar Al Natural",
description:
"Términos y condiciones de uso de los servicios de Bienestar Al Natural.",
};

export default function TerminosYCondicionesPage() {
return ( <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800"> <article className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm sm:p-10"> <header className="border-b border-slate-200 pb-6"> <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
Bienestar Al Natural </p>


      <h1 className="mt-2 text-3xl font-bold text-slate-950">
        Términos y condiciones
      </h1>

      <p className="mt-3 text-sm text-slate-500">
        Última actualización: 25 de junio de 2026
      </p>
    </header>

    <div className="mt-8 space-y-8 leading-7">
      <section>
        <h2 className="text-xl font-bold text-slate-950">
          1. Aceptación
        </h2>

        <p className="mt-3">
          Al utilizar nuestros canales de atención, página web o servicios
          de mensajería, la persona acepta estos términos y condiciones.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          2. Servicios ofrecidos
        </h2>

        <p className="mt-3">
          Bienestar Al Natural ofrece información y atención comercial
          relacionada con productos de bienestar y cuidado personal, según
          su disponibilidad y cobertura.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          3. Información de bienestar
        </h2>

        <p className="mt-3">
          La información proporcionada tiene fines generales y comerciales.
          No constituye diagnóstico, tratamiento médico ni reemplaza la
          consulta con un profesional de la salud.
        </p>

        <p className="mt-3">
          Las personas deben consultar a un profesional antes de tomar
          decisiones relacionadas con su salud, especialmente si tienen una
          condición médica, utilizan medicamentos, están embarazadas o
          presentan síntomas persistentes.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          4. Comunicaciones
        </h2>

        <p className="mt-3">
          La persona podrá recibir mensajes relacionados con solicitudes,
          atención, seguimiento o información comercial cuando haya
          autorizado dicho contacto o cuando sea legalmente permitido.
        </p>

        <p className="mt-3">
          En cualquier momento podrá solicitar que se suspendan las
          comunicaciones comerciales.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          5. Disponibilidad
        </h2>

        <p className="mt-3">
          Los productos, precios, promociones, horarios y zonas de cobertura
          pueden cambiar. La disponibilidad se confirmará directamente
          durante la atención.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          6. Uso adecuado
        </h2>

        <p className="mt-3">
          Está prohibido utilizar nuestros canales para realizar actividades
          fraudulentas, suplantar a terceros, afectar el funcionamiento de
          la aplicación o intentar acceder sin autorización a información o
          sistemas.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          7. Servicios de terceros
        </h2>

        <p className="mt-3">
          Algunos servicios dependen de proveedores tecnológicos externos,
          como WhatsApp, Meta, Vercel y Supabase. Su disponibilidad y
          funcionamiento también están sujetos a las condiciones de esos
          proveedores.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          8. Propiedad intelectual
        </h2>

        <p className="mt-3">
          Los nombres, textos, diseños, imágenes y demás contenidos propios
          de Bienestar Al Natural no pueden utilizarse con fines comerciales
          sin autorización.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          9. Protección de datos
        </h2>

        <p className="mt-3">
          El tratamiento de datos personales se realiza de acuerdo con
          nuestra Política de privacidad y tratamiento de datos personales.
        </p>

        <a
          href="/politica-de-privacidad"
          className="mt-3 inline-block font-semibold text-emerald-700 underline"
        >
          Consultar Política de privacidad
        </a>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          10. Modificaciones
        </h2>

        <p className="mt-3">
          Estos términos pueden modificarse cuando existan cambios legales,
          operativos o comerciales. La versión vigente será la publicada en
          esta página.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          11. Contacto
        </h2>

        <p className="mt-3">
          Para consultas relacionadas con estos términos:
        </p>

        <p className="mt-3">
          <a
            href="mailto:vidbienat@gmail.com"
            className="font-semibold text-emerald-700 underline"
          >
            vidbienat@gmail.com
          </a>
        </p>
      </section>
    </div>
  </article>
</main>


);
}
