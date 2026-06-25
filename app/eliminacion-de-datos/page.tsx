import type { Metadata } from "next";

export const metadata: Metadata = {
title: "Eliminación de datos | Bienestar Al Natural",
description:
"Instrucciones para solicitar la eliminación de datos personales.",
};

export default function EliminacionDeDatosPage() {
return ( <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800"> <article className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm sm:p-10"> <header className="border-b border-slate-200 pb-6"> <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
Bienestar Al Natural </p>


      <h1 className="mt-2 text-3xl font-bold text-slate-950">
        Instrucciones para la eliminación de datos
      </h1>

      <p className="mt-3 text-sm text-slate-500">
        Última actualización: 25 de junio de 2026
      </p>
    </header>

    <div className="mt-8 space-y-8 leading-7">
      <section>
        <h2 className="text-xl font-bold text-slate-950">
          Solicitud de eliminación
        </h2>

        <p className="mt-3">
          Cualquier persona puede solicitar la consulta, corrección,
          actualización o eliminación de los datos personales que Bienestar
          Al Natural tenga asociados a ella.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          Cómo presentar la solicitud
        </h2>

        <p className="mt-3">
          Envía un correo electrónico a:
        </p>

        <p className="mt-3">
          <a
            href="mailto:vidbienat@gmail.com?subject=Solicitud%20de%20eliminación%20de%20datos"
            className="font-semibold text-emerald-700 underline"
          >
            vidbienat@gmail.com
          </a>
        </p>

        <p className="mt-4">
          Utiliza como asunto:
        </p>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 font-semibold">
          Solicitud de eliminación de datos
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          Información necesaria
        </h2>

        <p className="mt-3">
          Incluye en el mensaje:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Nombre completo.</li>
          <li>Número de teléfono asociado.</li>
          <li>
            Descripción de los datos que deseas consultar, corregir o
            eliminar.
          </li>
          <li>Un medio para recibir la respuesta.</li>
        </ul>

        <p className="mt-3">
          Cuando sea necesario, podremos solicitar información adicional
          para verificar la identidad del titular y evitar la eliminación
          no autorizada de datos de otra persona.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          Trámite de la solicitud
        </h2>

        <p className="mt-3">
          La solicitud será revisada y respondida dentro de los términos
          legales aplicables. Cuando proceda, los datos serán eliminados,
          anonimizados, corregidos o restringidos.
        </p>

        <p className="mt-3">
          Es posible que cierta información deba conservarse cuando sea
          necesaria para cumplir obligaciones legales, resolver
          reclamaciones, prevenir fraude o proteger la seguridad de nuestros
          sistemas.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          Suspensión de mensajes comerciales
        </h2>

        <p className="mt-3">
          Para dejar de recibir mensajes comerciales, también puedes
          responder al mensaje indicando que no deseas recibir nuevas
          comunicaciones o enviar la solicitud al correo anterior.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-950">
          Política de privacidad
        </h2>

        <a
          href="/politica-de-privacidad"
          className="mt-3 inline-block font-semibold text-emerald-700 underline"
        >
          Consultar Política de privacidad
        </a>
      </section>
    </div>
  </article>
</main>


);
}
