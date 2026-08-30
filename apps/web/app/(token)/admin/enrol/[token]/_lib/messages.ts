/**
 * Every string the enrolment screen renders, in `es-CO`.
 *
 * Its own module, matching every other surface in this app. `docs/policy/voice.md`
 * binds this file at **Directness 5** — and this is the surface where that
 * dimension is doing real work rather than setting a tone: the codes are shown
 * once, nothing in this repository can read them back, and a person who closes
 * this page without keeping them has lost them. So the absence is stated first,
 * plainly, **above** the codes rather than below, where it would be read after
 * the decision it is trying to inform.
 *
 * **Nothing here says "admin" and nothing here names an account.** The person
 * holding the link already knows whose it is; nobody else should be told. That
 * rule comes from the surface brief's anti-goals and it is the same reasoning
 * that removed the door this screen replaces.
 */

/** The browser tab. The product's name, and no word for what this page is for. */
export const ENROL_PAGE_TITLE = "Configura tu segundo factor — Recomencemos";

export const ENROL_TITLE = "Configura tu segundo factor";

/**
 * The two acts, in the order they happen, in one sentence each.
 *
 * The second one is the whole reason this screen takes no input: the six digits
 * are typed back into the terminal that printed the link, which is what verifies
 * the authenticator and sets the grant. Saying so here is Do 3 — what to do next,
 * in the same breath.
 */
export const QR_INSTRUCTION = "Escanea este código con tu app de autenticación.";
export const TERMINAL_INSTRUCTION = "Después escribe los seis dígitos en la terminal.";

/** What a screen reader announces for the QR. Names what it is for, not what it is. */
export const QR_ALT = "Código QR para configurar tu app de autenticación";

/**
 * The manual-entry fallback, which costs one line and removes a whole class of
 * dead end: a failed camera, a glaring screen, an authenticator that will not
 * read a QR, or enrolling on the very phone that would have to photograph itself.
 */
export const MANUAL_SECRET_HEADING = "¿No puedes escanear?";
export const MANUAL_SECRET_EXPLANATION = "Escribe esta clave en tu app de autenticación.";

export const BACKUP_CODES_HEADING = "Tus códigos de respaldo";

/**
 * **Above the codes, and the absence first.** This is the one string on this
 * surface where Directness 5 is load-bearing: read after the codes, it is a
 * regret; read before them, it is an instruction.
 */
export const BACKUP_CODES_SHOWN_ONCE =
  "No vas a volver a ver estos códigos. Guárdalos antes de cerrar esta página.";

/** What they are for, said before somebody needs them rather than after. */
export const BACKUP_CODES_PURPOSE =
  "Cada uno sirve una sola vez, y son la única forma de entrar si pierdes el teléfono.";

/**
 * The one control on the page, and the states it can be in.
 *
 * A clipboard button with no feedback is the classic way this fails silently, so
 * the confirmation is a string rather than an icon — and the failure is a real
 * state, because the clipboard API refuses on an insecure context, an old
 * browser, or a denied permission. What it says then is the actual fallback: the
 * codes are selectable text and always were.
 */
export const COPY_CODES = "Copiar los códigos";
export const COPY_CODES_DONE = "Códigos copiados";
export const COPY_CODES_FAILED = "No se pudieron copiar. Puedes seleccionarlos y copiarlos a mano.";

/**
 * Where the codes may and may not live.
 *
 * **The condition, not the medium.** The rule underneath never depended on paper:
 * the mailbox is the other factor, so one unlock that opens both is one factor
 * wearing two coats. A separate vault, a separate device, or paper all satisfy
 * it; the same vault does not. This sentence belongs on this screen and not only
 * in a runbook, because this is where the decision is made.
 */
export const BACKUP_CODES_STORAGE =
  "Guárdalos donde no llegue la misma contraseña que abre tu correo: ese correo es el otro factor.";

/**
 * The `failed` state, which the surface brief lists and which is the one state
 * this page can reach that is not a 404.
 *
 * **It reaches a reader only when enrolment broke on our side** — a secret that
 * will not decrypt, a database that is not answering. The token was good; the
 * page could not render what it holds.
 *
 * **The reassurance is true rather than soothing, and it is the whole of what
 * needs saying: nothing has been granted.** The command is still sitting at its
 * prompt and no Account holds Admin authority, so running it again costs a fresh
 * QR and ten fresh codes and nothing else. Directness 5 puts that first, before
 * the offer to try again, because it is the fact that makes the offer safe.
 *
 * This is `es-CO` where the app's other error boundaries are still English —
 * those predate the voice guide and are listed for rewriting; a new surface does
 * not inherit that debt.
 */
export const ENROL_FAILED_TITLE = "No pudimos mostrar tu configuración";
export const ENROL_FAILED_EXPLANATION =
  "No se guardó nada y no se activó ninguna cuenta. Vuelve a ejecutar el comando en la terminal.";
export const ENROL_FAILED_RETRY = "Intentar de nuevo";
export const ENROL_FAILED_RETRYING = "Intentando…";
