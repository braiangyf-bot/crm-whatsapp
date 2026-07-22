import { exigirUsuarioPagina } from "@/lib/auth/exigirUsuarioPagina";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import ResponderLibre from "./ResponderLibre";
import CambiarEstadoConversacion from "./CambiarEstadoConversacion";
import ContenidoMensajeWhatsApp from "@/components/ContenidoMensajeWhatsApp";
import AutoRefrescarChat from "./AutoRefrescarChat";
import ClienteNotas from "./ClienteNotas";
import type { Prisma } from "@prisma/client";
import CambiarEtiquetaConversacion from "../CambiarEtiquetaConversacion";


export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
});

function mostrarFecha(fecha: Date | null): string {
    if (!fecha) {
        return "Sin fecha";
    }

    return formatoFecha.format(fecha);
}

function mostrarContenido(
    tipo: string,
    contenido: string | null,
    caption: string | null,
    nombreArchivo: string | null,
): string {
    if (contenido?.trim()) {
        return contenido.trim();
    }

    if (caption?.trim()) {
        return caption.trim();
    }

    if (nombreArchivo?.trim()) {
        return nombreArchivo.trim();
    }

    const nombres: Record<string, string> = {
        image: "Imagen",
        audio: "Audio",
        document: "Documento",
        video: "Video",
        sticker: "Sticker",
        location: "Ubicación",
        contacts: "Contacto compartido",
        interactive: "Mensaje interactivo",
        reaction: "Reacción",
        button: "Botón",
        order: "Pedido",
        system: "Mensaje del sistema",
        template: "Plantilla de WhatsApp",
    };

    return nombres[tipo] ?? "Mensaje sin contenido";
}

function etiquetaTipoMensaje(tipo: string): string {
    const etiquetas: Record<string, string> = {
        text: "Texto",
        image: "Imagen",
        audio: "Audio",
        document: "Documento",
        video: "Video",
        sticker: "Sticker",
        location: "Ubicación",
        contacts: "Contacto",
        interactive: "Interactivo",
        reaction: "Reacción",
        button: "Botón",
        order: "Pedido",
        system: "Sistema",
        template: "Plantilla",
        unknown: "Desconocido",
    };

    return etiquetas[tipo] ?? "Mensaje";
}

function mostrarEstado(
    direccion: string,
    estadoApi: string | null,
): string {
    if (direccion === "entrante") {
        return "Recibido";
    }

    const estados: Record<string, string> = {
        accepted: "Aceptado",
        sent: "Enviado",
        delivered: "Entregado",
        read: "Leído",
        failed: "Fallido",
    };

    return estados[estadoApi ?? ""] ?? estadoApi ?? "Pendiente";
}
const etiquetasComerciales = [
    "pendiente",
    "contactado",
    "interesado",
    "cliente",
    "no_responde",
] as const;

type EtiquetaComercial = (typeof etiquetasComerciales)[number];

function esEtiquetaComercial(
    valor: string | undefined,
): valor is EtiquetaComercial {
    return (
        typeof valor === "string" &&
        etiquetasComerciales.includes(valor as EtiquetaComercial)
    );
}

function obtenerEtiquetaComercial(
    metadata: Prisma.JsonValue,
): EtiquetaComercial | "" {
    if (
        metadata &&
        typeof metadata === "object" &&
        !Array.isArray(metadata)
    ) {
        const valor = (metadata as Record<string, unknown>)
            .etiqueta_comercial;

        if (typeof valor === "string" && esEtiquetaComercial(valor)) {
            return valor;
        }
    }

    return "";
}

function nombreEtiquetaComercial(etiqueta: EtiquetaComercial | ""): string {
    const nombres: Record<EtiquetaComercial, string> = {
        pendiente: "Pendiente",
        contactado: "Contactado",
        interesado: "Interesado",
        cliente: "Cliente",
        no_responde: "No responde",
    };

    return etiqueta ? nombres[etiqueta] : "Sin etiqueta";
}

function clasesEtiquetaComercial(etiqueta: EtiquetaComercial | ""): string {
    const clases: Record<EtiquetaComercial, string> = {
        pendiente: "bg-yellow-100 text-yellow-800",
        contactado: "bg-sky-100 text-sky-800",
        interesado: "bg-emerald-100 text-emerald-800",
        cliente: "bg-blue-100 text-blue-800",
        no_responde: "bg-red-100 text-red-800",
    };

    return etiqueta ? clases[etiqueta] : "bg-slate-100 text-slate-600";
}

export default async function ConversacionPage({
    params,
}: PageProps) {
    await exigirUsuarioPagina();

    const { id } = await params;

    const fechaLecturaInterna = new Date();

    await prisma.$transaction([
        prisma.mensajes_whatsapp.updateMany({
            where: {
                conversacion_id: id,
                direccion: "entrante",
                fecha_leido_internamente: null,
            },
            data: {
                fecha_leido_internamente: fechaLecturaInterna,
            },
        }),

        prisma.conversaciones_whatsapp.updateMany({
            where: {
                id,
                no_leidos: {
                    gt: 0,
                },
            },
            data: {
                no_leidos: 0,
                fecha_leida_internamente: fechaLecturaInterna,
            },
        }),
    ]);

    const conversacion =
        await prisma.conversaciones_whatsapp.findUnique({
            where: {
                id,
            },
            select: {
                id: true,
                telefono_cliente: true,
                nombre_cliente: true,
                estado: true,
                no_leidos: true,
                fecha_ultimo_mensaje: true,
                ventana_atencion_hasta: true,
                metadata: true,

                clientes: {
                    select: {
                        id: true,
                        nombre: true,
                        cedula: true,
                        telefono: true,
                        estado: true,
                        notas: true,
                    },
                },

                mensajes_whatsapp: {
                    orderBy: {
                        fecha_mensaje: "asc",
                    },
                    select: {
                        id: true,
                        direccion: true,
                        tipo: true,
                        contenido: true,
                        caption: true,
                        estado_api: true,
                        fecha_mensaje: true,
                        media_id: true,
                        mime_type: true,
                        nombre_archivo: true,
                        template_name: true,
                    },
                },
            },
        });

    if (!conversacion) {
        notFound();
    }

    const ventanaActiva =
        conversacion.ventana_atencion_hasta !== null &&
        conversacion.ventana_atencion_hasta > new Date();

    const nombre =
        conversacion.nombre_cliente?.trim() ||
        conversacion.clientes?.nombre?.trim() ||
        "Contacto sin nombre";

    const etiquetaComercial = obtenerEtiquetaComercial(
        conversacion.metadata,
    );

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6">
            <AutoRefrescarChat intervaloMs={8000} />
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/bandeja"
                    className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                    ← Volver a la bandeja
                </Link>

                <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-emerald-700">
                                Conversación de WhatsApp
                            </p>

                            <h1 className="mt-1 text-2xl font-bold text-slate-900">
                                {nombre}
                            </h1>

                            <p className="mt-1 text-sm text-slate-600">
                                {conversacion.telefono_cliente}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                {conversacion.estado}
                            </span>

                            {etiquetaComercial ? (
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${clasesEtiquetaComercial(
                                        etiquetaComercial,
                                    )}`}
                                >
                                    {nombreEtiquetaComercial(etiquetaComercial)}
                                </span>
                            ) : null}

                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${ventanaActiva
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-200 text-slate-700"
                                    }`}
                            >
                                {ventanaActiva
                                    ? "Ventana de 24 horas activa"
                                    : "Ventana de 24 horas cerrada"}
                            </span>

                            {conversacion.no_leidos > 0 && (
                                <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
                                    {conversacion.no_leidos} sin leer
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Seguimiento comercial
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Clasifica esta conversación para hacer seguimiento.
                            </p>
                        </div>

                        <CambiarEtiquetaConversacion
                            conversacionId={conversacion.id}
                            etiquetaActual={etiquetaComercial}
                        />
                    </div>
                </section>

                <section className="mt-5 rounded-xl bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">
                        Datos del contacto
                    </h2>

                    {conversacion.clientes ? (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    NOMBRE
                                </p>
                                <p className="text-sm text-slate-800">
                                    {conversacion.clientes.nombre}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    CÉDULA
                                </p>
                                <p className="text-sm text-slate-800">
                                    {conversacion.clientes.cedula}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    TELÉFONO
                                </p>
                                <p className="text-sm text-slate-800">
                                    {conversacion.clientes.telefono}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    ESTADO
                                </p>
                                <p className="text-sm text-slate-800">
                                    {conversacion.clientes.estado}
                                </p>
                            </div>

                            <ClienteNotas
                                clienteId={conversacion.clientes.id}
                                notasIniciales={conversacion.clientes.notas}
                            />
                        </div>
                    ) : (
                        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                            Este teléfono no está relacionado con un cliente del CRM.
                        </div>
                    )}
                </section>

                <section className="mt-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">
                            Mensajes
                        </h2>

                        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold">
                            {conversacion.mensajes_whatsapp.length}
                        </span>
                    </div>

                    <div className="space-y-3 rounded-xl bg-slate-200 p-4">
                        {conversacion.mensajes_whatsapp.map((mensaje) => {
                            const entrante = mensaje.direccion === "entrante";

                            return (
                                <article
                                    key={mensaje.id}
                                    className={`flex ${entrante ? "justify-start" : "justify-end"}`}
                                >
                                    <div
                                        className={`flex max-w-[85%] flex-col ${entrante ? "items-start" : "items-end"
                                            }`}
                                    >
                                        <span className="mb-1 px-1 text-[11px] font-semibold text-slate-500">
                                            {entrante ? "Cliente" : "Tú"}
                                        </span>

                                        <div
                                            className={`w-fit rounded-2xl px-4 py-3 shadow-sm ${entrante
                                                ? "rounded-bl-sm bg-white text-slate-900"
                                                : "rounded-br-sm bg-emerald-100 text-slate-900"
                                                }`}
                                        >
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                    {etiquetaTipoMensaje(mensaje.tipo)}
                                                </span>

                                                {mensaje.nombre_archivo ? (
                                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                                        Archivo
                                                    </span>
                                                ) : null}
                                            </div>

                                            <ContenidoMensajeWhatsApp
                                                tipo={mensaje.tipo}
                                                texto={mensaje.contenido ?? mensaje.caption}
                                                mediaId={mensaje.media_id}
                                                mimeType={mensaje.mime_type}
                                                nombreArchivo={mensaje.nombre_archivo}
                                            />

                                            {mensaje.template_name && (
                                                <p className="mt-2 text-xs text-violet-700">
                                                    Plantilla: {mensaje.template_name}
                                                </p>
                                            )}

                                            <div className="mt-2 flex flex-wrap justify-end gap-2 text-xs text-slate-500">
                                                <span>
                                                    {mostrarFecha(mensaje.fecha_mensaje)}
                                                </span>

                                                <span className="font-semibold">
                                                    {mostrarEstado(
                                                        mensaje.direccion,
                                                        mensaje.estado_api,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
                {conversacion.estado !== "abierta" ? (
                    <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        Esta conversación está {conversacion.estado}. Para responder,
                        primero debes reabrirla.
                    </section>
                ) : null}

                <ResponderLibre
                    conversacionId={conversacion.id}
                    ventanaActiva={
                        ventanaActiva && conversacion.estado === "abierta"
                    }
                />
                <CambiarEstadoConversacion
                    conversacionId={conversacion.id}
                    estadoActual={conversacion.estado as "abierta" | "cerrada" | "archivada"}
                />
            </div>
        </main>
    );
}