import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@repo/design-system/components/sonner";
import { cn } from "@repo/design-system/lib/utils";
import { SiteHeader, SiteHeaderSkeleton } from "./_components/site-header/site-header";
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
  // Deliberately not the same sentences as `app/page.tsx`. This one is read in a
  // search result by someone who has not arrived yet, so it names the product and
  // what it does; the page speaks to someone already here. Story 4 replaces the
  // page and not this, and one string with two owners is how they drift apart.
  description:
    "Recomencemos conecta a personas de Pereira, Dosquebradas y Santa Rosa de Cabal " +
    "con quien quiera pagarles por un trabajo.",
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
        {/*
          The shell (#80), above every page. It reads the session, which is
          **dynamic** — no `use cache` anywhere near it, per ADR-0011 and
          `apps/web/AGENTS.md`, because a cached session read serves one person's
          identity to the next.

          Cache Components therefore requires a boundary here. `[stream]` from
          the framework's own menu rather than `[block]`: no page should wait on
          chrome before it paints, and the fallback holds the header's exact
          height so nothing moves when the read resolves.
        */}
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
