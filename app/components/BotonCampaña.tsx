"use client";

import { useState } from "react";

type ComponentePlantillaMeta = {
  type: string;
  format?: string;
};

type PlantillaMeta = {
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText: string;
  variableCount: number;
  variableNames?: string[];
  tieneMultimedia: boolean;
  components?: ComponentePlantillaMeta[];
};

type BotonCampañaProps = {
  clienteId: string;
  nombreCliente: string;
  telefonoCliente: string;

  // Lo dejamos para no romper app/page.tsx si todavía lo está enviando.
  plantillas?: unknown[];
};

type RespuestaPlantillas = {
  plantillas?: PlantillaMeta[];
  error?: string;
  detalle?: {
    error?: {
      message?: string;
    };
  };
};

type RespuestaCampana = {
  error?: string;
  detalle?: {
    error?: {
      message?: string;
      error_data?: {
        details?: string;
      };
    };
  };
};

function formatearTamano(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
  const [imagenHeader, setImagenHeader] = useState<File | null>(null);

  const plantillaSeleccionada = plantillasMeta.find(
    (plantilla) => `${plantilla.name}|${plantilla.language}` === plantillaKey
  );

  const headerFormat =
    plantillaSeleccionada?.components
      ?.find((component) => component.type === "HEADER")
      ?.format?.toUpperCase() || "";

  const requiereImagenHeader =
    headerFormat === "IMAGE" ||
    plantillaSeleccionada?.name === "promocion_limpieza_facial";

  const tieneMultimediaNoSoportada =
    Boolean(plantillaSeleccionada?.tieneMultimedia) &&
    !requiereImagenHeader;

  function crearVariablesBody(): string[] {
    if (!plantillaSeleccionada || plantillaSeleccionada.variableCount <= 0) {
      return [];
    }

    return Array.from(
      { length: plantillaSeleccionada.variableCount },
      (_, indice) => {
        if (indice === 0) {
          return nombreCliente || "cliente";
        }

        return "";
      }
    );
  }

  function reemplazarVariablesVistaPrevia(texto: string): string {
    let resultado = texto;

    if (!plantillaSeleccionada) {
      return resultado;
    }

    const variablesBody = crearVariablesBody();

    plantillaSeleccionada.variableNames?.forEach((nombreVariable, indice) => {
      resultado = resultado.replaceAll(
        `{{${nombreVariable}}}`,
        variablesBody[indice] || ""
      );
    });

    variablesBody.forEach((valor, indice) => {
      resultado = resultado.replaceAll(`{{${indice + 1}}}`, valor);
    });

    return resultado;
  }

  const mensajePreview = plantillaSeleccionada
    ? reemplazarVariablesVistaPrevia(plantillaSeleccionada.bodyText)
    : "";

  async function cargarPlantillasMeta() {
    try {
      setCargandoPlantillas(true);
      setError("");
      setExito("");
      setImagenHeader(null);

      const respuesta: Response = await fetch("/api/whatsapp/plantillas");
      const data = (await respuesta.json()) as RespuestaPlantillas;

      if (!respuesta.ok) {
        const mensajeError =
          data.detalle?.error?.message ||
          data.error ||
          "Error cargando plantillas de Meta.";

        setError(mensajeError);
        return;
      }

      setPlantillasMeta(data.plantillas || []);
    } catch (errorDesconocido) {
      console.warn("ERROR CARGANDO PLANTILLAS META:", errorDesconocido);
      setError("Error inesperado cargando plantillas de Meta.");
    } finally {
      setCargandoPlantillas(false);
    }
  }

  function manejarCambioPlantilla(valor: string) {
    setPlantillaKey(valor);
    setImagenHeader(null);
    setError("");
    setExito("");
  }

  function manejarCambioImagen(archivo?: File | null) {
    setError("");
    setExito("");

    if (!archivo) {
      setImagenHeader(null);
      return;
    }

    if (!["image/jpeg", "image/png"].includes(archivo.type)) {
      setImagenHeader(null);
      setError("La imagen del encabezado debe ser JPG o PNG.");
      return;
    }

    if (archivo.size > 4 * 1024 * 1024) {
      setImagenHeader(null);
      setError("La imagen pesa más de 4 MB. Comprime la imagen antes de enviarla.");
      return;
    }

    setImagenHeader(archivo);
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

      if (tieneMultimediaNoSoportada) {
        setError(
          "Esta plantilla tiene multimedia, pero este envío individual solo soporta encabezado con imagen."
        );
        return;
      }

      if (requiereImagenHeader && !imagenHeader) {
        setError(
          "Esta plantilla requiere una imagen de encabezado. Adjunta una imagen JPG o PNG antes de enviarla."
        );
        return;
      }

      setCargando(true);

      const formData = new FormData();

      formData.append("canal", "api_oficial");
      formData.append("cliente_id", clienteId);
      formData.append("plantilla_id", "");
      formData.append("nombre_cliente", nombreCliente);
      formData.append("telefono_cliente", telefonoCliente);
      formData.append("nombre_plantilla", plantillaSeleccionada.name);
      formData.append(
        "mensaje_enviado",
        mensajePreview || plantillaSeleccionada.bodyText
      );
      formData.append("meta_template_name", plantillaSeleccionada.name);
      formData.append("meta_template_language", plantillaSeleccionada.language);
      formData.append(
        "meta_variable_count",
        String(plantillaSeleccionada.variableCount)
      );
      formData.append(
        "meta_body_variables",
        JSON.stringify(crearVariablesBody())
      );
      formData.append(
        "meta_variable_names",
        JSON.stringify(plantillaSeleccionada.variableNames ?? [])
      );
      formData.append("meta_header_format", headerFormat);

      if (requiereImagenHeader && imagenHeader) {
        formData.append("meta_header_image_file", imagenHeader);
      }

      const respuesta: Response = await fetch("/api/campanas", {
        method: "POST",
        body: formData,
      });

      const data = (await respuesta.json()) as RespuestaCampana;

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
        setImagenHeader(null);
        setExito("");
        setError("");
      }, 1500);
    } catch (errorDesconocido) {
      console.warn("ERROR EN BOTON CAMPAÑA:", errorDesconocido);
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
              onChange={(event) => manejarCambioPlantilla(event.target.value)}
              disabled={cargandoPlantillas}
              className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">
                {cargandoPlantillas
                  ? "Cargando plantillas de Meta..."
                  : "Selecciona una plantilla"}
              </option>

              {plantillasMeta.map((plantilla) => {
                const formatoHeader =
                  plantilla.components
                    ?.find((component) => component.type === "HEADER")
                    ?.format?.toUpperCase() || "";

                const etiqueta =
                  formatoHeader === "IMAGE"
                    ? " - requiere imagen"
                    : plantilla.tieneMultimedia
                      ? " - multimedia"
                      : "";

                return (
                  <option
                    key={`${plantilla.name}-${plantilla.language}`}
                    value={`${plantilla.name}|${plantilla.language}`}
                  >
                    {plantilla.name} - {plantilla.language} -{" "}
                    {plantilla.category}
                    {etiqueta}
                  </option>
                );
              })}
            </select>

            {!cargandoPlantillas && plantillasMeta.length === 0 && (
              <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                No hay plantillas aprobadas en Meta para mostrar.
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

                {requiereImagenHeader && (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
                    <label className="mb-1 block text-sm font-semibold text-emerald-800">
                      Imagen del encabezado
                    </label>

                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(event) =>
                        manejarCambioImagen(event.target.files?.[0] ?? null)
                      }
                      className="w-full rounded border border-emerald-200 bg-white px-3 py-2 text-sm"
                    />

                    <p className="mt-1 text-xs text-emerald-700">
                      Adjunta una imagen JPG o PNG. Máximo 4 MB.
                    </p>

                    {imagenHeader && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-emerald-800">
                          {imagenHeader.name} · {formatearTamano(imagenHeader.size)}
                        </p>

                        <img
                          src={URL.createObjectURL(imagenHeader)}
                          alt="Vista previa de encabezado"
                          className="mt-2 max-h-48 max-w-full rounded border object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {tieneMultimediaNoSoportada && (
                  <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                    Esta plantilla tiene multimedia, pero por ahora este botón
                    solo soporta plantillas de texto o plantillas con encabezado
                    de imagen.
                  </div>
                )}

                <p className="mt-3 whitespace-pre-wrap rounded bg-white p-2">
                  {mensajePreview}
                </p>
              </div>
            )}

            <div className="mb-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
              Puedes enviar plantillas de texto y plantillas con encabezado de
              imagen. Si la plantilla tiene imagen, debes adjuntarla antes de
              enviar.
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
                  setImagenHeader(null);
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
                disabled={
                  cargando ||
                  cargandoPlantillas ||
                  !plantillaSeleccionada ||
                  tieneMultimediaNoSoportada ||
                  (requiereImagenHeader && !imagenHeader)
                }
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