"use client";

import { useState } from "react";

type PlantillaMeta = {
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText: string;
  variableCount: number;
  tieneMultimedia: boolean;
};

type BotonCampañaProps = {
  clienteId: string;
  nombreCliente: string;
  telefonoCliente: string;

  // Lo dejamos para no romper app/page.tsx si todavía lo está enviando.
  plantillas?: unknown[];
};

export default function BotonCampaña({
  clienteId,
  nombreCliente,
  telefonoCliente,
}: BotonCampañaProps) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [plantillasMeta, setPlantillasMeta] = useState<PlantillaMeta[]>([]);
  const [plantillaKey, setPlantillaKey] = useState("");

  const plantillaSeleccionada = plantillasMeta.find(
    (plantilla) => `${plantilla.name}|${plantilla.language}` === plantillaKey
  );

  const mensajePreview = plantillaSeleccionada
    ? plantillaSeleccionada.bodyText.replaceAll("{{1}}", nombreCliente)
    : "";

  async function cargarPlantillasMeta() {
    try {
      setCargandoPlantillas(true);
      setError("");
      setExito("");

      const respuesta = await fetch("/api/whatsapp/plantillas");
      const data = await respuesta.json();

      if (!respuesta.ok) {
        const mensajeError =
          data.detalle?.error?.message ||
          data.error ||
          "Error cargando plantillas de Meta.";

        setError(mensajeError);
        return;
      }

      setPlantillasMeta(data.plantillas || []);
    } catch (error) {
      console.warn("ERROR CARGANDO PLANTILLAS META:", error);
      setError("Error inesperado cargando plantillas de Meta.");
    } finally {
      setCargandoPlantillas(false);
    }
  }

  async function enviarPorApi() {
    try {
      setError("");
      setExito("");

      if (!clienteId) {
        setError("Falta el ID del cliente.");
        return;
      }

      if (!plantillaSeleccionada) {
        setError("Selecciona una plantilla aprobada de Meta.");
        return;
      }

      setCargando(true);

      const respuesta = await fetch("/api/campanas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canal: "api_oficial",
          cliente_id: clienteId,
          plantilla_id: null,
          nombre_cliente: nombreCliente,
          telefono_cliente: telefonoCliente,
          nombre_plantilla: plantillaSeleccionada.name,
          mensaje_enviado: mensajePreview || plantillaSeleccionada.bodyText,
          meta_template_name: plantillaSeleccionada.name,
          meta_template_language: plantillaSeleccionada.language,
          meta_variable_count: plantillaSeleccionada.variableCount,
        }),
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        const mensajeError =
          data.detalle?.error?.error_data?.details ||
          data.detalle?.error?.message ||
          data.error ||
          "Error enviando campaña por API.";

        console.warn("ERROR ENVIANDO CAMPAÑA API:", data);

        setError(mensajeError);
        return;
      }

      setExito("Mensaje enviado por API oficial.");
      console.log("CAMPAÑA API ENVIADA:", data);

      setTimeout(() => {
        setAbierto(false);
        setPlantillaKey("");
        setExito("");
        setError("");
      }, 1500);
    } catch (error) {
      console.warn("ERROR EN BOTON CAMPAÑA:", error);
      setError("Error inesperado enviando campaña.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          cargarPlantillasMeta();
        }}
        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
      >
        Campaña API
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h2 className="mb-3 text-lg font-bold text-gray-800">
              Enviar campaña por API oficial
            </h2>

            <div className="mb-3 text-sm text-gray-600">
              <p>
                <strong>Cliente:</strong> {nombreCliente}
              </p>
              <p>
                <strong>Teléfono:</strong> {telefonoCliente}
              </p>
            </div>

            <label className="mb-1 block text-sm font-medium text-gray-700">
              Plantilla aprobada de Meta
            </label>

            <select
              value={plantillaKey}
              onChange={(event) => setPlantillaKey(event.target.value)}
              disabled={cargandoPlantillas}
              className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">
                {cargandoPlantillas
                  ? "Cargando plantillas de Meta..."
                  : "Selecciona una plantilla"}
              </option>

              {plantillasMeta.map((plantilla) => (
                <option
                  key={`${plantilla.name}-${plantilla.language}`}
                  value={`${plantilla.name}|${plantilla.language}`}
                >
                  {plantilla.name} - {plantilla.language} - {plantilla.category}
                </option>
              ))}
            </select>

            {!cargandoPlantillas && plantillasMeta.length === 0 && (
              <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                No hay plantillas simples aprobadas en Meta. Crea o aprueba una
                plantilla sin imagen/carrusel para poder enviarla desde aquí.
              </div>
            )}

            {plantillaSeleccionada && (
              <div className="mb-4 rounded border bg-gray-50 p-3 text-sm text-gray-700">
                <p className="mb-1 font-semibold">
                  Vista previa de plantilla Meta:
                </p>

                <p>
                  <strong>Nombre:</strong> {plantillaSeleccionada.name}
                </p>

                <p>
                  <strong>Idioma:</strong> {plantillaSeleccionada.language}
                </p>

                <p>
                  <strong>Categoría:</strong> {plantillaSeleccionada.category}
                </p>

                <p>
                  <strong>Variables:</strong>{" "}
                  {plantillaSeleccionada.variableCount}
                </p>

                <p className="mt-3 whitespace-pre-wrap rounded bg-white p-2">
                  {mensajePreview}
                </p>
              </div>
            )}

            <div className="mb-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
              Solo se muestran plantillas aprobadas de Meta, sin multimedia y
              con máximo una variable.
            </div>

            {error && (
              <div className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {exito && (
              <div className="mb-3 rounded bg-green-100 p-2 text-sm text-green-700">
                {exito}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  setPlantillaKey("");
                  setError("");
                  setExito("");
                }}
                disabled={cargando}
                className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={enviarPorApi}
                disabled={cargando || cargandoPlantillas || !plantillaSeleccionada}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
              >
                {cargando ? "Enviando..." : "Enviar por API oficial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}