/**
 * `/profile/[slug]` — what a Hirer reads once he has an Account.
 *
 * **The page has one job and the copy exists to stay out of its way.** What is
 * worth reading here is hers: her one line, her own words about what she does,
 * and the work she has done. Everything in this file is a heading or a label
 * around that, which is why there are so few strings and why none of them
 * describes her.
 *
 * **Nothing here claims anything about verification or money.** Those are story
 * 11's two standing notices and this surface is on their list; a half-version
 * written into a section heading would give them a second source, which is the
 * one thing worse than an absent notice. The slot is marked in the page.
 */

/**
 * The document title. Deliberately not her name or her headline: a title reaches
 * the browser's tab, the history and whatever the operating system shares from
 * it, and NFR8 keeps this surface out of an index precisely so that a person
 * here is not addressable from outside. It is generic on every profile, which is
 * also what makes it useless as a confirmation that a slug names somebody.
 */
export const PROFILE_PAGE_TITLE = "Perfil — Recomencemos";

/** Over her own words. Her sentences are the content; this only names them. */
export const ABOUT_HEADING = "En sus palabras";

/** Over the work history. "Ha hecho" rather than "experiencia", which is a CV word. */
export const WORK_HISTORY_HEADING = "Trabajos que ha hecho";

/**
 * She published a profile and left the two long fields empty, which is a
 * complete profile and not a broken one — the Skills and the headline are the
 * whole of what she chose to say. So this states that rather than apologising
 * for it, and it points at the thing that is still true.
 *
 * **It names the Skills rather than where they are on the screen.** "Está
 * arriba" is true in DOM order and stops being true the moment the layout
 * changes or the reader is not looking at a screen at all — which is
 * `docs/policy/voice.md`'s rule that meaning may not be carried by position.
 * `/code-review` caught the first version.
 */
export const NOTHING_MORE = "No escribió más. Sus capacidades son lo que publicó.";

/** Back to where he probably came from. Names the destination, never "volver". */
export const TO_BROWSE = "Ver todos los perfiles";

/**
 * The seventh state (C39), and the two sentences it may say are the ceiling's
 * own — `CEILING_REFUSALS` in `@repo/domain/rate-limit` holds them, because the
 * refusal has to quote a count and a wait this surface does not know. What is
 * here is the heading over it.
 *
 * **"Pausa" rather than "bloqueo" or "límite alcanzado".** He may read again in
 * minutes, and a word that sounds like a sanction would describe a person by a
 * rule that is about a rate.
 */
export const RATE_LIMITED_HEADING = "Pausamos la lectura de perfiles";
