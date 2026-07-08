import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "CRM WhatsApp",
        short_name: "CRM WhatsApp",
        description:
            "CRM para gestión de clientes, campañas y bandeja de conversaciones de WhatsApp.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#0f172a",
        orientation: "portrait",
        lang: "es-CO",
        icons: [
            {
                src: "/icons/icon.svg",
                sizes: "512x512",
                type: "image/svg+xml",
                purpose: "maskable",
            },
        ],
    };
}