"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AutoRefrescarChatProps = {
    intervaloMs?: number;
};

export default function AutoRefrescarChat({
    intervaloMs = 8000,
}: AutoRefrescarChatProps) {
    const router = useRouter();

    useEffect(() => {
        function refrescarSiEstaVisible() {
            if (document.visibilityState === "visible") {
                router.refresh();
            }
        }

        const intervalo = window.setInterval(
            refrescarSiEstaVisible,
            intervaloMs,
        );

        document.addEventListener(
            "visibilitychange",
            refrescarSiEstaVisible,
        );

        return () => {
            window.clearInterval(intervalo);
            document.removeEventListener(
                "visibilitychange",
                refrescarSiEstaVisible,
            );
        };
    }, [router, intervaloMs]);

    return null;
}