import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@repo/design-system/components/sonner";
import { cn } from "@repo/design-system/lib/utils";
import "@repo/design-system/globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Recomencemos",
  description:
    "Personas de Pereira, Dosquebradas y Santa Rosa de Cabal publican lo que saben hacer. " +
    "Quien quiera pagarles por un trabajo las encuentra aquí.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `lang` is `es-CO` because that is the product's only language and every
  // string below this is Spanish (ADR-0012). The attribute is what a screen
  // reader takes its phonemes from, so `en` would announce Spanish in English.
  return (
    <html
      lang="es-CO"
      className={cn("font-sans antialiased", fontSans.variable, fontMono.variable)}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
