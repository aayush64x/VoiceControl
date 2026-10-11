"use client";

import { useEffect, useRef, useState } from "react";
import { SPLINE_BACKDROP } from "@/lib/spline";
import { asset } from "@/lib/asset";

// The scene from https://my.spline.design/aiassistanthoverandclickinteraction-7yFCdoBgUTHnlSjQc483FxY1/
// exported as a .splinecode file and served from our own domain, together with the runtime's
// WASM helpers, so nothing is fetched from Spline's CDN.
const SCENE_URL = asset("/spline/assistant.splinecode");
const WASM_PATH = asset("/spline/wasm");
// Used only if the self-hosted scene cannot start (e.g. no WebGL); still the live, interactive scene.
const FALLBACK_EMBED_URL =
  "https://my.spline.design/aiassistanthoverandclickinteraction-7yFCdoBgUTHnlSjQc483FxY1/";

type Status = "loading" | "ready" | "failed";

export function SplineScene({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let app: import("@splinetool/runtime").Application | undefined;
    let observer: IntersectionObserver | undefined;

    (async () => {
      try {
        const { Application } = await import("@splinetool/runtime");
        if (disposed) return;
        app = new Application(canvas, { wasmPath: WASM_PATH, htmlContentMode: "none" });
        await app.load(SCENE_URL);
        if (disposed) return;
        app.setBackgroundColor(SPLINE_BACKDROP);
        // Follow the cursor anywhere on the page, including over the hero text and buttons.
        app.setGlobalEvents(true);
        setStatus("ready");
        // Pause rendering while the hero is scrolled out of view, so the rest of the page stays smooth.
        observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) app?.play();
          else app?.stop();
        });
        observer.observe(canvas);
      } catch (error) {
        console.error("Spline scene failed to start", error);
        if (!disposed) setStatus("failed");
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      app?.dispose();
    };
  }, []);

  if (status === "failed") {
    return (
      <iframe
        src={FALLBACK_EMBED_URL}
        title="Interactive 3D AI assistant"
        className={`border-0 ${className}`}
        allow="autoplay; fullscreen"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label="Interactive 3D AI assistant"
      role="img"
      data-status={status}
      className={`transition-opacity duration-700 ${status === "ready" ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
