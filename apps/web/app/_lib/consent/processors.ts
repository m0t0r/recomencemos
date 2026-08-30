/**
 * The six companies outside Colombia that handle personal data on this
 * platform's behalf, each with its country and what it is for.
 *
 * **Every one of them is a *transmisión* under Ley 1581**, because the
 * *responsable* is in Colombia and the recipient is not. That is what makes this
 * list a legal disclosure rather than a colophon: the *aviso de privacidad* has
 * to name each recipient, and the *autorización* has to carry express consent to
 * the transmission. Express authorization is taken rather than made to depend on
 * how SIC adequacy is read, so the list holds however Circular Externa 005 de
 * 2017 turns out to be read.
 *
 * **Adding a vendor is a change to this array and a version bump beside it.**
 * `CONSENT_NOTICE_VERSIONS` in `@repo/domain/consent` is the other half; a row
 * recording the old version has to keep meaning the list as it stood, which is
 * only true if the two move together.
 *
 * **The identifiers are English and the values are `es-CO`** (ADR-0012). `name`
 * is a company's own name and is not translated; `country` and `purpose` are read
 * by a person in Risaralda.
 *
 * The countries are the recipients' own. Two are also pinned by where this
 * product actually runs, which `fly.toml` records: Fly's `iad` is Ashburn,
 * Virginia, and PlanetScale's `us-east-1` is beside it.
 */

export interface Processor {
  readonly name: string;
  readonly country: string;
  readonly purpose: string;
}

export const PROCESSORS: readonly Processor[] = [
  {
    name: "PlanetScale",
    country: "Estados Unidos",
    purpose: "Guarda la base de datos: tu cuenta, tu perfil y las propuestas.",
  },
  {
    name: "Fly.io",
    country: "Estados Unidos",
    purpose: "Corre el sitio. Todo lo que escribes pasa por sus servidores.",
  },
  {
    name: "Cloudflare",
    country: "Estados Unidos",
    purpose: "Guarda y entrega las fotos de los perfiles.",
  },
  {
    name: "Google",
    country: "Estados Unidos",
    purpose: "Te deja entrar con tu cuenta de Google, si escoges esa puerta.",
  },
  {
    name: "Resend",
    country: "Estados Unidos",
    purpose: "Envía los correos: el enlace para entrar y los avisos.",
  },
  {
    name: "Sentry",
    country: "Estados Unidos",
    purpose: "Nos avisa cuando algo falla. No recibe tus datos personales.",
  },
];
