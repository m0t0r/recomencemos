/**
 * The document, and nothing that belongs to a particular audience.
 *
 * **The chrome moved down a level with #17**, and the reason is that the Admin's
 * surfaces are not the Worker's. `SiteHeader` renders the signed-in identity, the
 * session menu and _salir_ — a shell built for a Worker on a phone — and it used
 * to sit here, above every route. A nested `app/admin/layout.tsx` cannot remove a
 * parent's chrome, so the only way for `/admin` to have a shell of its own was for
 * this file to stop having one: `(site)` carries the public header, `(admin)`
 * carries the queue's, and what is left here is `<html>` and the fonts.
 *
 * Neither group adds a URL segment, so nothing a person can see or link to moved.
 *
 * **The toast region went the same way for a different reason** (#157). It was
 * the last thing here that belonged to a page rather than to the document, and
 * because it sat above every route, sonner shipped to `/` and `/privacy` — where
 * nothing toasts, and where nothing anywhere in this app toasts, because there is
 * not one caller of `toast` in the tree yet. A live region with no producers,
 * downloaded by every visitor. `packages/design-system/src/components/sonner.tsx`
 * carries the note about mounting exactly one of them, which is where the first
 * surface that needs a toast will be looking.
 */

import type { Metadata } from "next";
import { Alegreya, Geist_Mono, Inter } from "next/font/google";
import { cn } from "@repo/design-system/lib/utils";
import "@repo/design-system/globals.css";

/**
 * Two families, clearly distinct, and `DESIGN.md` → Typography is why.
 *
 * Inter is the working face: forms, labels, data, the Admin queue. Alegreya
 * carries the display role and her own words — the one line on a card nobody
 * else could have written. It is a Latin American face (Huerta Tipográfica,
 * Buenos Aires) drawn for long Spanish reading, with a calligraphic rhythm that
 * says "written by a person" without the costume of a handwriting font.
 *
 * Both are self-hosted by `next/font`, so no request leaves for a font host and
 * neither counts against NFR3, which measures scripts. Alegreya ships the two
 * weights the ramp uses and both styles; the italic is the voice of a quotation,
 * which is what a headline on a card is.
 */
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontDisplay = Alegreya({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
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
      className={cn(
        "font-sans antialiased",
        fontSans.variable,
        fontDisplay.variable,
        fontMono.variable,
      )}
    >
      <body>
        {/*
          impeccable:direction d843eaaf
          WORLD: the ruled notebook — the cuaderno a tienda in Risaralda keeps,
          where the barrio's names and work are written by hand and one person
          keeps the book. Ink blue on paper white, light rulings, a rose margin.
          FIRST VIEWPORT: a solid ink cover carrying the proposition and one
          action, hers; under it the ruled page of the newest profiles.
          VISITOR PATH: cover → the vocabulary drifting → the page → how it works.
          SIGNATURE: her own words in Alegreya, as the only line nobody else wrote.
          REACH: every list is a ruled page with a margin; every state is a mark.
        */}
        {children}
      </body>
    </html>
  );
}
