"use client";

import { useEffect, useState } from "react";

type EstadoNotificaciones =
  | "cargando"
  | "no_soportado"
  | "pendiente"
  | "permitido"
  | "suscrito"
  | "denegado";

function obtenerEstadoInicial(): EstadoNotificaciones {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "no_soportado";
  }

  if (Notification.permission === "granted") {
    return "permitido";
  }

  if (Notification.permission === "denied") {
    return "denegado";
  }

  return "pendiente";
}

function convertirBase64UrlAUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = `${base64Url}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const datos = window.atob(base64);
  const salida = new Uint8Array(datos.length);

  for (let i = 0; i < datos.length; i += 1) {
    salida[i] = datos.charCodeAt(i);
  }

  return salida;
}

export default function ActivarNotificaciones() {
  const [estado, setEstado] =
    useState<EstadoNotificaciones>("cargando");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    async function verificarEstado() {
      const estadoInicial = obtenerEstadoInicial();
      setEstado(estadoInicial);

      if (estadoInicial !== "permitido") {
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const suscripcionActual =
        await registro.pushManager.getSubscription();

      if (suscripcionActual) {
        setEstado("suscrito");
      }
    }

    verificarEstado().catch((error) => {
      console.error("Error verificando notificaciones:", error);
      setEstado(obtenerEstadoInicial());
    });
  }, []);

  async function manejarActivacion() {
    setMensaje("");

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setEstado("no_soportado");
      setMensaje(
        "Este navegador no soporta notificaciones push o service workers."
      );
      return;
    }

    if (Notification.permission === "denied") {
      setEstado("denegado");
      setMensaje(
        "Las notificaciones están bloqueadas. Debes habilitarlas manualmente desde la configuración del navegador."
      );
      return;
    }

    setProcesando(true);

    try {
      const permiso =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "pendiente");
        setMensaje("No se concedió el permiso de notificaciones.");
        return;
      }

      setEstado("permitido");

      const vapidPublicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        setMensaje(
          "Permiso concedido. Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY para crear la suscripción real."
        );
        return;
      }

      const registro = await navigator.serviceWorker.ready;

      const suscripcionExistente =
        await registro.pushManager.getSubscription();

      const suscripcion =
        suscripcionExistente ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            convertirBase64UrlAUint8Array(vapidPublicKey),
        }));

      const datosSuscripcion = suscripcion.toJSON();

      const respuesta = await fetch("/api/push/suscribir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: datosSuscripcion.endpoint,
          expirationTime: datosSuscripcion.expirationTime ?? null,
          keys: {
            p256dh: datosSuscripcion.keys?.p256dh,
            auth: datosSuscripcion.keys?.auth,
          },
          userAgent: navigator.userAgent,
          nombreDispositivo: "Navegador principal",
        }),
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          resultado?.error || "No se pudo guardar la suscripción push."
        );
      }

      setEstado("suscrito");
      setMensaje("Notificaciones activadas correctamente en este navegador.");
    } catch (error) {
      console.error("Error activando notificaciones:", error);
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudieron activar las notificaciones."
      );
    } finally {
      setProcesando(false);
    }
  }

  async function manejarDesactivacion() {
    setMensaje("");
    setProcesando(true);

    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();

      if (!suscripcion) {
        setEstado(obtenerEstadoInicial());
        setMensaje("No había una suscripción activa en este navegador.");
        return;
      }

      const endpoint = suscripcion.endpoint;

      await suscripcion.unsubscribe();

      const respuesta = await fetch("/api/push/desuscribir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          resultado?.error || "No se pudo desactivar la suscripción push."
        );
      }

      setEstado("permitido");
      setMensaje("Suscripción desactivada en este navegador.");
    } catch (error) {
      console.error("Error desactivando notificaciones:", error);
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudieron desactivar las notificaciones."
      );
    } finally {
      setProcesando(false);
    }
  }

  const textoBoton =
    estado === "suscrito"
      ? "Notificaciones activas"
      : procesando
        ? "Procesando..."
        : "Activar notificaciones";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Notificaciones de WhatsApp
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Activa este navegador para recibir alertas de nuevos mensajes
            entrantes cuando se conecte el envío push real.
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Estado actual:{" "}
            <span className="font-semibold">
              {estado === "cargando" && "Verificando..."}
              {estado === "no_soportado" && "No soportado"}
              {estado === "pendiente" && "Pendiente"}
              {estado === "permitido" && "Permiso concedido"}
              {estado === "suscrito" && "Suscrito"}
              {estado === "denegado" && "Bloqueado"}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={manejarActivacion}
            disabled={
              procesando ||
              estado === "no_soportado" ||
              estado === "denegado" ||
              estado === "suscrito"
            }
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {textoBoton}
          </button>

          {estado === "suscrito" && (
            <button
              type="button"
              onClick={manejarDesactivacion}
              disabled={procesando}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Desactivar
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {mensaje}
        </p>
      )}
    </section>
  );
}