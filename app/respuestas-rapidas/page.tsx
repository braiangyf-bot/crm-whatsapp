"use client";

import { useEffect, useState } from "react";

type RespuestaRapida = {
  id: string;
  titulo: string;
  contenido: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export default function RespuestasRapidasPage() {
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([]);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [activa, setActiva] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarRespuestas() {
    try {
      setCargando(true);
      setError("");

      const respuesta = await fetch("/api/respuestas-rapidas", {
        cache: "no-store",
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(data.error || "No se pudieron cargar las respuestas.");
      }

      setRespuestas(data.respuestas || []);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "Error cargando respuestas rápidas.",
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarRespuestas();
  }, []);

  function limpiarFormulario() {
    setTitulo("");
    setContenido("");
    setActiva(true);
    setEditandoId(null);
    setError("");
    setMensaje("");
  }

  function editarRespuesta(respuesta: RespuestaRapida) {
    setEditandoId(respuesta.id);
    setTitulo(respuesta.titulo);
    setContenido(respuesta.contenido);
    setActiva(respuesta.activa);
    setError("");
    setMensaje("");
  }

  async function guardarRespuesta() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const tituloLimpio = titulo.trim();
      const contenidoLimpio = contenido.trim();

      if (!tituloLimpio) {
        setError("El título es obligatorio.");
        return;
      }

      if (!contenidoLimpio) {
        setError("El contenido es obligatorio.");
        return;
      }

      const url = editandoId
        ? `/api/respuestas-rapidas/${editandoId}`
        : "/api/respuestas-rapidas";

      const metodo = editandoId ? "PUT" : "POST";

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo: tituloLimpio,
          contenido: contenidoLimpio,
          activa,
        }),
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(data.error || "No se pudo guardar la respuesta.");
      }

      setMensaje(
        editandoId
          ? "Respuesta rápida actualizada."
          : "Respuesta rápida creada.",
      );

      limpiarFormulario();
      await cargarRespuestas();
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "Error guardando respuesta rápida.",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarRespuesta(id: string) {
    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar esta respuesta rápida?",
    );

    if (!confirmar) {
      return;
    }

    try {
      setError("");
      setMensaje("");

      const respuesta = await fetch(`/api/respuestas-rapidas/${id}`, {
        method: "DELETE",
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(data.error || "No se pudo eliminar la respuesta.");
      }

      setMensaje("Respuesta rápida eliminada.");
      await cargarRespuestas();
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "Error eliminando respuesta rápida.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Respuestas rápidas
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Crea y edita mensajes frecuentes para usarlos en la bandeja de
          WhatsApp.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            {editandoId ? "Editar respuesta" : "Nueva respuesta"}
          </h2>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Título
              </label>

              <input
                value={titulo}
                onChange={(evento) => setTitulo(evento.target.value)}
                placeholder="Ej: Saludo inicial"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Contenido
              </label>

              <textarea
                value={contenido}
                onChange={(evento) => setContenido(evento.target.value)}
                rows={7}
                maxLength={4000}
                placeholder="Escribe la respuesta rápida..."
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              <p className="mt-1 text-xs text-slate-500">
                {contenido.length}/4000 caracteres
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={activa}
                onChange={(evento) => setActiva(evento.target.checked)}
              />
              Activa
            </label>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            {mensaje ? (
              <div className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
                {mensaje}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={guardarRespuesta}
                disabled={guardando}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:bg-slate-300"
              >
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Actualizar"
                    : "Crear"}
              </button>

              {editandoId ? (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Respuestas guardadas
          </h2>

          {cargando ? (
            <p className="mt-4 text-sm text-slate-500">
              Cargando respuestas...
            </p>
          ) : null}

          {!cargando && respuestas.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Todavía no hay respuestas rápidas.
            </p>
          ) : null}

          <div className="mt-4 grid gap-3">
            {respuestas.map((respuesta) => (
              <article
                key={respuesta.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {respuesta.titulo}
                    </h3>

                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                        respuesta.activa
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {respuesta.activa ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editarRespuesta(respuesta)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarRespuesta(respuesta.id)}
                      className="rounded-lg border border-red-200 px-3 py-1 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {respuesta.contenido}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}