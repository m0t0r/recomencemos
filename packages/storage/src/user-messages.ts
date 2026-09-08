/**
 * The `es-CO` half of this package's refusals.
 *
 * **Every string here is read by a Worker, so it answers to
 * [`docs/policy/voice.md`](../../../docs/policy/voice.md) in full** — 20 words a
 * sentence, active voice with the actor named, what happened and what to do in
 * the same breath, and never a word from a `CONTEXT.md` _Avoid_ list. A byte
 * count, a MIME type and the word *bucket* are all things the store knows and
 * she does not.
 *
 * **A separate file for the reason `@repo/domain/src/user-messages.ts` is one:**
 * `AppError.message` is operator-facing English and reaches the log line;
 * `userMessage` is the only string permitted to reach a browser, and keeping the
 * two apart in the source is what stops one being defaulted to the other.
 *
 * Spanish is the interface, English is the code (ADR-0012), so every identifier
 * on this page is English and every value is Spanish.
 */

/**
 * The store is not configured. She is told the photo cannot be added *now* and
 * that nothing else is affected — because nothing else is: the profile does not
 * wait for a photo, and this is a fact about our deploy rather than about her.
 */
export const PHOTO_UNAVAILABLE =
  "Ahora mismo no podemos recibir fotos. Tu perfil no depende de esto. Intenta más tarde.";

/**
 * The picture is too big or is not one we can read, after the browser already
 * tried to shrink it.
 *
 * **In her terms**, which the acceptance criterion asks for by name. It says
 * what is wrong with the picture and what to do about it, and it quotes no
 * number: DD6's ceiling is 2 MB, and *"la foto pesa más de 2 MB"* is a sentence
 * about a file and not about a photo. Choosing another one from the same camera
 * roll is the whole remedy.
 */
export const PHOTO_TOO_LARGE =
  "Esa foto es muy pesada y no pudimos reducirla. Elige otra desde tu teléfono.";

/** The bytes did not decode to a picture at all — or decoded to something that is not one. */
export const PHOTO_UNREADABLE = "No pudimos leer esa foto. Elige otra desde tu teléfono.";

/** The transfer failed. The network, not her, and picking again is the retry. */
export const PHOTO_UPLOAD_FAILED = "No pudimos subir tu foto. Vuelve a elegirla.";
