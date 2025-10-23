
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Providers from "../components/Providers";
import React from "react";

export const metadata: Metadata = {
  title: "Starker Goot - Ponto Eletrônico",
  description: "Um sistema web de bateria ponto eletrônico online para funcionários da Starker Goot Engenharia LTDA, com funcionalidades de login, registro de ponto com foto e geolocalização, relatórios de serviço, justificativas e um painel administrativo completo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <Script src="https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@latest/dist/jspdf.plugin.autotable.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-primary text-text-base">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
