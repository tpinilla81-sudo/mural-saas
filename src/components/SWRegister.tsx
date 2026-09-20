"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA (silencioso si falla). */
export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
