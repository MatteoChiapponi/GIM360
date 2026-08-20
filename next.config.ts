import type { NextConfig } from "next";
import { TIMEZONE } from "./lib/timezone";

// La zona horaria del proyecto es Argentina, no la del servidor (que está en
// Estados Unidos). Esto la fija en el proceso que evalúa la config: el build y
// el server de dev. El server de producción la vuelve a fijar en
// `instrumentation.ts`, que es lo que corre en el arranque de cada instancia.
process.env.TZ = TIMEZONE

const allowedOrigins = process.env.AUTH_URL ? [process.env.AUTH_URL] : []

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: allowedOrigins[0] ?? "http://localhost:3000",
          },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ]
  },
};

export default nextConfig;
