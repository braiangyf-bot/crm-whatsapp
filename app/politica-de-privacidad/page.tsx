import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | Bienestar Al Natural",
  description: "Política de privacidad y tratamiento de datos personales.",
};

export default function PoliticaDePrivacidadPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <article className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold text-slate-950">
          Política de privacidad y tratamiento de datos personales
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          Última actualización: 25 de junio de 2026
        </p>

        <div className="mt-8 space-y-6 leading-7">
          <section>
            <h2 className="text-xl font-bold">Responsable del tratamiento</h2>
            <p className="mt-2">
              Bienestar Al Natural es responsable del tratamiento de los datos
              personales utilizados en sus canales de atención, aplicación de
              gestión de clientes y comunicaciones mediante WhatsApp.
            </p>
            <p className="mt-2">
              Contacto:{" "}
              <a
                href="mailto:vidbienat@gmail.com"
                className="font-semibold text-emerald-700 underline"
              >
                vidbienat@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Datos tratados</h2>
            <p className="mt-2">
              Podemos tratar nombre, teléfono, identificación, información
              suministrada durante la atención, historial de contacto, notas
              comerciales y estados de los mensajes de WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Finalidades</h2>
            <p className="mt-2">
              Los datos se utilizan para atender solicitudes, gestionar
              clientes, enviar comunicaciones autorizadas, realizar seguimiento
              comercial, prevenir fraudes y cumplir obligaciones legales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Proveedores tecnológicos</h2>
            <p className="mt-2">
              Para prestar nuestros servicios podemos utilizar proveedores como
              Meta, WhatsApp, Vercel y Supabase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Derechos de los titulares</h2>
            <p className="mt-2">
              Las personas pueden consultar, actualizar, corregir o solicitar la
              eliminación de sus datos personales y revocar su autorización
              cuando legalmente corresponda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Eliminación de datos</h2>
            <p className="mt-2">
              Las solicitudes pueden enviarse a vidbienat@gmail.com indicando
              el nombre, teléfono asociado y la información que se desea
              consultar, corregir o eliminar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Cambios en esta política</h2>
            <p className="mt-2">
              Esta política podrá actualizarse cuando existan cambios legales,
              técnicos u operativos.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
