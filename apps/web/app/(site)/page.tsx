/**
 * The holding page, and only until story 4 lands.
 *
 * `/` is the **Wall** — the public list of the most recently published
 * CapabilityProfiles (`CONTEXT.md`). It does not exist yet: story 4
 * (https://github.com/m0t0r/recomencemos/issues/21) builds it, and this file is
 * what that ticket replaces. What it is *not* is design-system scaffolding, and
 * it is not `create-next-app` output either — both were deleted with the
 * template framing this repository came from.
 *
 * **It deliberately makes no claim about verification or money.** Those are
 * story 11's two standing notices
 * (https://github.com/m0t0r/recomencemos/issues/22), which are product
 * components rendered on the Wall, on `/profiles`, and on every profile and
 * Offer surface. A half-version here would give them a second source, and the
 * one thing worse than an absent notice is two that disagree.
 *
 * The copy follows `docs/policy/voice.md`: `tú`-register `es-CO`, sentences
 * under twenty words, active voice with the actor named, and no word from a
 * `CONTEXT.md` *Avoid* list. Nobody is named by what happened to them.
 */

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-prose flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Recomencemos</h1>

      <div className="text-muted-foreground flex flex-col gap-3 text-lg text-pretty">
        <p>Personas de Pereira, Dosquebradas y Santa Rosa de Cabal publican lo que saben hacer.</p>
        <p>Quien quiera pagarles por un trabajo las encuentra aquí.</p>
      </div>

      <p className="text-muted-foreground text-sm">
        Todavía no está abierto. Cuando lo abramos, aquí vas a ver los perfiles más recientes.
      </p>
    </main>
  );
}
