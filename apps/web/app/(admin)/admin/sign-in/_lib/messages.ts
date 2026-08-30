/**
 * Every string `/admin/sign-in` renders, in `es-CO`.
 *
 * **Its own module, matching `(site)/(auth)/sign-in/_lib/messages.ts`.** The
 * door's copy lived in the queue's message module until review pointed out that
 * one file was then changing for two unrelated reasons — the queue's wording and
 * the door's — while the public sign-in surface next door already owned its own.
 * `ADMIN_SESSION_REQUIRED` stays with the queue, because the gate is what renders
 * it and this surface is the one route that never calls the gate.
 *
 * The register is `../../_lib/messages.ts`'s: `docs/policy/voice.md` binds this
 * file too, at Directness 5, for someone who uses this door daily and at speed.
 */

/** The sign-in door at `/admin/sign-in`. */
export const ADMIN_SIGN_IN_PAGE_TITLE = "Entrar — Recomencemos";
export const ADMIN_SIGN_IN_TITLE = "Entrar";
export const EMAIL_LABEL = "Correo";
export const PASSWORD_LABEL = "Contraseña";
export const CONTINUE = "Continuar";
export const CONTINUING = "Entrando…";

/**
 * The second factor.
 *
 * **The backup codes are named here rather than only in the error copy**, because
 * the person who has lost the phone needs to know the codes work *before* they
 * have failed six times. DD5 makes those ten printed codes a required recovery
 * path (C43); a recovery path nobody is told about is not one.
 */
export const CODE_HEADING = "Tu código";
export const CODE_EXPLANATION =
  "Abre tu app de autenticación y escribe el código de seis dígitos. También sirve uno de tus códigos de respaldo.";
export const CODE_LABEL = "Código";
export const VERIFY = "Entrar";
export const VERIFYING = "Comprobando…";

/**
 * Enrolment — shown once, on the first sign-in after runbook §6's grant.
 *
 * **The copy carries the one instruction that has no second chance.** Better Auth
 * encrypts the secret and the codes at rest and nothing in this repository
 * decrypts them, so a person who closes this screen without writing the codes down
 * has lost them. Runbook §6 says "printed and stored offline — on paper, not in
 * the password manager that also holds the password", and that sentence has to be
 * on the screen where it applies rather than only in a document.
 */
export const ENROL_HEADING = "Configura tu segundo factor";
export const ENROL_EXPLANATION =
  "Escanea este código con tu app de autenticación. Después escribe el código de seis dígitos para terminar.";
export const BACKUP_CODES_HEADING = "Tus códigos de respaldo";
export const BACKUP_CODES_EXPLANATION =
  "Imprímelos y guárdalos en papel, fuera del gestor de contraseñas que ya tiene tu contraseña. No los volverás a ver, y son la única forma de entrar si pierdes el teléfono.";
export const QR_ALT = "Código QR para configurar tu app de autenticación";

/**
 * The backup-code door, on the sign-in step.
 *
 * **Written for someone who has lost their phone**, which is who reaches it: DD5
 * makes the ten printed codes a required recovery path, and C43 is what happens
 * without one — every Offer stops behind NFR7's 24-hour band and every reported
 * Hirer stays frozen. So the disclosure says what it is for rather than what it
 * is, and the description says where the codes are, because the person looking
 * for them is looking under stress.
 */
export const BACKUP_CODE_DISCLOSURE = "¿No tienes el teléfono a mano?";
export const BACKUP_CODE_LABEL = "Código de respaldo";
export const BACKUP_CODE_EXPLANATION =
  "Uno de los códigos que imprimiste al configurar el segundo factor. Cada uno sirve una sola vez.";

/**
 * The form's own field messages, replacing Zod's English (ADR-0014's second rule:
 * no Zod message reaches a person).
 *
 * **One sentence for both credential fields**, and it says nothing about either. A
 * message distinguishing "falta el correo" from "falta la contraseña" would be a
 * form narrating itself to the one person who filled it in; one quoting the
 * sixteen-character floor would tell an attacker how long the Admin's password is.
 * What is left is the true and useless thing.
 */
export const ADMIN_CREDENTIALS_REQUIRED = "Faltan datos.";

/** The second factor's field message. Same reasoning, one field. */
export const CODE_REQUIRED = "Escribe el código.";
