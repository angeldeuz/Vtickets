import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El monorepo termina en Vtickets. Evita que Next.js tome lockfiles
  // encontrados en carpetas superiores como raíz del proyecto.
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  turbopack: { root: path.resolve(__dirname, "..") },
  // La portada admite 5 MiB; multipart agrega un pequeño margen al cuerpo.
  experimental: { serverActions: { bodySizeLimit: "6mb" } }
};

export default nextConfig;
