"use client";

import Link from "next/link";
import { useState, type SubmitEvent } from "react";

type DetalleImportacion = {
  fila: number;
  tipo: "invalida" | "duplicada";
  motivo: string;
};

type ResultadoImportacion = {
  mensaje: string;
  resumen: {
    filasLeidas: number;
    creados: number;
    duplicados: number;
    invalidos: number;
  };
  detalles: DetalleImportacion[];
  detallesLimitados: boolean;
};

export default function ImportarClientesPage() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] =
    useState<ResultadoImportacion | null>(null);

  function descargarPlantilla() {
    const contenido = [
      "nombre;cedula;telefono;estado;notas",
      "Cliente de ejemplo;123456789;3001234567;pendiente;Observación opcional",
    ].join("\n");

    const blob = new Blob(["\uFEFF", contenido], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "plantilla-clientes.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  }

  async function importar(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResultado(null);

    if (!archivo) {
      setError("Selecciona un archivo CSV antes de continuar.");
      return;
    }

    const formData = new FormData();
    formData.append("archivo", archivo);

    try {
      setCargando(true);

      const respuesta = await fetch("/api/clientes/importar", {
        method: "POST",
        body: formData,
      });

      const datos = (await respuesta.json()) as
        | ResultadoImportacion
        | { error?: string };

      if (!respuesta.ok) {
        setError(
          "error" in datos && datos.error
            ? datos.error
            : "No fue posible importar el archivo."
        );
        return;
      }

      setResultado(datos as ResultadoImportacion);
    } catch {
      setError(
        "Ocurrió un error de conexión mientras se importaban los clientes."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Importar clientes desde CSV
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Carga clientes masivamente con validación de datos y control de duplicados.
            </p>
          </div>

          <Link
            href="/"
            className="w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Volver al CRM
          </Link>
        </header>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-bold text-blue-900">
            Formato esperado
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            Las columnas obligatorias son nombre, cedula y telefono. Las columnas estado y notas son opcionales.
          </p>

          <div className="mt-3 overflow-x-auto rounded-lg border border-blue-200 bg-white p-3 font-mono text-sm text-gray-700">
            nombre;cedula;telefono;estado;notas
          </div>

          <ul className="mt-3 space-y-1 text-sm text-blue-900">
            <li>
              • Se aceptan celulares de 10 dígitos o de 12 dígitos con prefijo 57; se guardan en formato nacional de 10 dígitos.
            </li>
            <li>
              • Los estados permitidos son pendiente, contactado, interesado, cliente y no_responde.
            </li>
            <li>
              • El sistema omite cédulas y teléfonos repetidos.
            </li>
            <li>
              • En Excel, configura las columnas cédula y teléfono como texto para evitar notación científica.
            </li>
            <li>
              • Se aceptan CSV separados por coma, punto y coma o tabulación.
            </li>
          </ul>

          <button
            type="button"
            onClick={descargarPlantilla}
            className="mt-4 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
          >
            Descargar plantilla CSV
          </button>
        </section>

        <form
          onSubmit={importar}
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <label
            htmlFor="archivo"
            className="block text-sm font-semibold text-gray-800"
          >
            Archivo CSV
          </label>

          <input
            id="archivo"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setArchivo(event.target.files?.[0] || null);
              setError("");
              setResultado(null);
            }}
            className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800"
          />

          {archivo && (
            <p className="mt-2 text-sm text-gray-500">
              Archivo seleccionado: {archivo.name}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="mt-4 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {cargando ? "Importando..." : "Importar clientes"}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {resultado && (
          <section className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
              {resultado.mensaje}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">
                  Filas leídas
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {resultado.resumen.filasLeidas}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">
                  Clientes creados
                </p>
                <p className="text-2xl font-bold text-green-700">
                  {resultado.resumen.creados}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">
                  Duplicados omitidos
                </p>
                <p className="text-2xl font-bold text-yellow-700">
                  {resultado.resumen.duplicados}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">
                  Filas inválidas
                </p>
                <p className="text-2xl font-bold text-red-700">
                  {resultado.resumen.invalidos}
                </p>
              </div>
            </div>

            {resultado.detalles.length > 0 && (
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h2 className="font-bold text-gray-900">
                    Filas omitidas
                  </h2>
                  <p className="text-sm text-gray-500">
                    Revisa estas filas en el archivo original y corrígelas antes de volver a importarlas.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-4 py-3">Fila</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Motivo</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {resultado.detalles.map((detalle, indice) => (
                        <tr key={`${detalle.fila}-${indice}`}>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {detalle.fila}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                                detalle.tipo === "duplicada"
                                  ? "border-yellow-200 bg-yellow-100 text-yellow-800"
                                  : "border-red-200 bg-red-100 text-red-700"
                              }`}
                            >
                              {detalle.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {detalle.motivo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {resultado.detallesLimitados && (
                  <p className="border-t bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    Solo se muestran los primeros 200 detalles.
                  </p>
                )}
              </div>
            )}

            <Link
              href="/"
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ver clientes importados
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}