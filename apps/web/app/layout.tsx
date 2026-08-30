/**
 * The document, and nothing that belongs to a particular audience.
 *
 * **The chrome moved down a level with #17**, and the reason is that the Admin's
 * surfaces are not the Worker's. `SiteHeader` renders the signed-in identity, the
 * session menu and _salir_ — a shell built for a Worker on a phone — and it used
 * to sit here, above every route. A nested `app/admin/layout.tsx` cannot remove a
 * parent's chrome, so the only way for `/admin` to have a shell of its own was for
 * this file to stop having one: `(site)` carries the public header, `(admin)`
 * carries the queue's, and what is left here is `<html>`, the fonts, and the toast
 * region both need.
 *
 * Neither group adds a URL segment, so nothing a person can see or link to moved.
 */

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
        {children}
        {/*
          The toast region stays here rather than moving into `(site)`, because
          both groups render into it and one `<Toaster />` per group would mean
          two live regions on a page — which a screen reader announces as two.
        */}
        <Toaster />
      </body>
    </html>
  );
}
