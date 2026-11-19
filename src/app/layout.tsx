import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

// Polices téléchargées au moment de la construction et servies par l'application
// (aucun appel à Google depuis le navigateur des clientes).
const texte = Montserrat({ subsets: ["latin"], variable: "--police-texte", display: "swap" });
const titre = Playfair_Display({ subsets: ["latin"], variable: "--police-titre", display: "swap" });

export const metadata: Metadata = {
  title: "Elyamaje — Conseillère en ligne",
  description: "Posez vos questions sur nos produits, la livraison et nos formations en onglerie.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${texte.variable} ${titre.variable}`}>
      <body>{children}</body>
    </html>
  );
}
