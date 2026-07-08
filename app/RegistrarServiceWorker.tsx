"use client";

import { useEffect } from "react";

export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const esLocalhost = window.location.hostname === "localhost";
    const esHttps = window.location.protocol === "https:";

    if (!esLocalhost && !esHttps) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Error registrando service worker:", error);
    });
  }, []);

  return null;
}