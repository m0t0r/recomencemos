/**
 * Every `es-CO` string `/sign-in` puts in front of a person.
 *
 * Collected in one module rather than written at each render site, for the
 * reason `@repo/domain`'s own `user-messages.ts` gives: the same fact should
 * read the same way wherever it appears, and a surface with seven states has
 * seven chances to say the same thing three ways.
 *
 * The authority is [`docs/policy/voice.md`](../../../../docs/policy/voice.md).
 * The rules these strings are checked against, all countable:
 *
 * - **`tú`, throughout.** Second person singular, informal, on every surface.
 * - **Body copy ≤ 20 words per sentence; labels and buttons ≤ 5.**
 * - **No exclamation marks**, except at most one in a success state — and never
 *   in a refusal, a notice, or an email subject.
 * - **Buttons say the verb of their action**, never _Enviar_ or _Continuar_.
 * - **An error names what happened and what to do**, and never refers to meaning
 *   carried by colour or position.
 * - **Nobody is named by what happened to them.** No word from a `CONTEXT.md`
 *   _Avoid_ list, and the earthquake is never a property of a person.
 * - **Refusal tone** — Optimism 3→4, Energy 2→1, Warmth 5 unchanged: the refusal
 *   is our rule, never her mistake.
 *
 * `sign-in-copy.test.ts` checks the countable ones over every string here, so a
 * later edit cannot quietly break them.
 */

/** The page's one `<h1>`. A verb and the product, and nothing about her. */
export const SIGN_IN_TITLE = "Entrar a Recomencemos";

/**
 * What she is told before she types anything — the ticket's own acceptance
 * criterion. It renders as the field's description, above the input and inside
 * the label's `aria-describedby`, rather than as placeholder text: placeholder
 * text disappears the moment she starts typing, which is exactly when she would
 * want to check it, and a screen reader may never announce it at all.
 */
export const EMAIL_DOOR_PRECONDITION =
  "Para entrar por correo necesitas una dirección que puedas abrir ahora.";

/** The label on the address field. */
export const EMAIL_LABEL = "Tu correo";

/** A button says the verb of its action. Four words. */
export const SEND_LINK_BUTTON = "Enviar el enlace";

/** The other door. Named, because it is never a dead end. */
export const GOOGLE_BUTTON = "Entrar con Google";

/**
 * The borrowed-Android warning (DD5), where a person will read it rather than in
 * a settings page. It does not promise which account — it says she will choose,
 * which is true because `prompt: "select_account"` makes it true.
 */
export const GOOGLE_ACCOUNT_NOTICE =
  "Google te va a preguntar con cuál cuenta entrar. Escoge la tuya.";

/** The shared-device checkbox. The spec fixes these words. */
export const SHARED_DEVICE_LABEL = "Este no es mi teléfono";

/**
 * What the checkbox actually does, in her terms: hours rather than a policy
 * name, and the thing she can do about it.
 */
export const SHARED_DEVICE_HELP =
  "Si lo marcas, cerramos tu sesión a las 8 horas. Si no, seguirás dentro en este teléfono.";

/**
 * **Said whether or not the address has an Account**, which is the acceptance
 * criterion and is also simply true: a magic link creates the Account when she
 * opens it, so the mail goes either way. There is nothing to hedge, and hedging
 * — _"si esa dirección existe…"_ — would be the enumeration hint the honest
 * sentence avoids.
 *
 * **A function, and the minutes are a parameter, because this module is reached
 * from a Client Component.** The authority on the number is
 * `MAGIC_LINK_TTL_MINUTES` in `@repo/domain` — but importing it here put
 * `@repo/domain/auth-handler` on the client graph, and with it `#connection` and
 * `pg`. `server-only` refused that at the door, which is mechanism 2 doing its
 * job; the fix is not to reach for the constant from a module a browser can
 * load. `actions.ts` runs on the server, imports the real number, and calls
 * this. Caught by seam 3 against a running `next dev`, not by `check-types`.
 */
export function checkYourEmail(expiresInMinutes: number): string {
  return `Revisa tu correo. Te enviamos un enlace para entrar y dura ${expiresInMinutes} minutos.`;
}

/** Ábrelo aquí, not on the laptop she does not have. */
export const CHECK_YOUR_EMAIL_HINT =
  "Ábrelo desde este mismo teléfono. Si no llega, míralo en la carpeta de spam.";

/**
 * The typo she can still fix while looking at the field. Names what happened and
 * what to do, and does not call her input invalid — _inválido_ makes it her
 * error rather than our rule.
 */
export const EMAIL_LOOKS_WRONG =
  "Esa dirección no parece un correo. Revísala e inténtalo de nuevo.";

/**
 * Send failed. Her address is still in the field, and that is the point of the
 * sentence: nothing she did was lost, and trying again is worth doing.
 */
export const SEND_FAILED_HINT = "No pudimos enviar el enlace. Vuelve a intentarlo en un momento.";

/**
 * **Google failed → the email door is still offered, never a dead end.** The
 * spec's own words for this cell of the surface table.
 */
export const GOOGLE_FAILED =
  "No pudimos entrar con Google. Puedes intentarlo otra vez, o pedir un enlace a tu correo.";

/**
 * A consumed link offers an immediate resend (DD5). This is not an error and is
 * not written as one: a link scanner opening it first is our problem, not hers,
 * and the next sentence is a button rather than an apology.
 */
export const LINK_ALREADY_USED =
  "Ese enlace ya se usó o se venció. Pídenos otro y te lo enviamos ahora.";

/** The resend button. Three words, and the verb of its action. */
export const RESEND_LINK_BUTTON = "Enviar otro enlace";

/** Every string above, for the copy test. Adding one here is what puts it under the rules. */
export const SIGN_IN_COPY = {
  SIGN_IN_TITLE,
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LABEL,
  SEND_LINK_BUTTON,
  GOOGLE_BUTTON,
  GOOGLE_ACCOUNT_NOTICE,
  SHARED_DEVICE_LABEL,
  SHARED_DEVICE_HELP,
  CHECK_YOUR_EMAIL_HINT,
  EMAIL_LOOKS_WRONG,
  SEND_FAILED_HINT,
  GOOGLE_FAILED,
  LINK_ALREADY_USED,
  RESEND_LINK_BUTTON,
} as const;

/** The ones the voice guide holds to five words. */
export const SIGN_IN_LABELS = {
  EMAIL_LABEL,
  SEND_LINK_BUTTON,
  GOOGLE_BUTTON,
  SHARED_DEVICE_LABEL,
  RESEND_LINK_BUTTON,
} as const;
