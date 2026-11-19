import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produit un serveur autonome minimal, idéal pour l'image Docker.
  output: "standalone",
};

export default nextConfig;
