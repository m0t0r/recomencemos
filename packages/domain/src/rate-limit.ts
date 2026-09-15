/**
 * NFR26's ceilings, and the first of them.
 *
 * **The scarcest resource in this design is one person's attention** (DD7), and
 * nothing bounded it before this module. What ships here is the mechanism plus
 * `requestMagicLink`; NFR26's other ceilings are rows in {@link CEILINGS} added
 * by the slices that need them, and that registry is the count.
 *
 * **The counter lives in Postgres, not in process memory**, because deploys are
 * continuous and an in-memory limiter resets several times a day — which is the
 * defect NFR26 rejects in those words, and the same reason Better Auth's own
 * limiter is pointed at the database rather than left on its default.
 *
 * **A refusal returns; it does not throw.** That is NFR26's second half: an
 * `AppError` thrown out of here on every refusal would let a crawler spend the
 * month's 5,000-event Sentry allowance in a day and make the second real
 * incident of the month invisible. The refusal still *carries* an `AppError`,
 * because the operator-facing half of a refusal is worth having — it is simply
 * returned rather than raised, and CLAUDE.md's "thrown is reported; returned is
 * logged" is the rule being followed.
 *
 * **It fails closed, and that is the one thing that does throw.** If the counter
 * cannot be read or written the database error propagates, the action does not
 * happen, and nothing is sent. A counter that cannot count must not be read as
 * permission — and unlike a refusal, a database that is not answering is a real
 * incident and has earned its Sentry event.
 */

import { createHash } from "node:crypto";
import { AppError } from "@repo/errors/app-error";
import { lt, sql } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import { rateCounter } from "#schema";
import { SERVICE_UNAVAILABLE } from "#user-messages";

/** One ceiling: how many, over how long. */
export interface Ceiling {
  readonly max: number;
  readonly windowSeconds: number;
}

/**
 * **The ceilings, as data**, so C57's "checked as a list against the UX state
 * table rather than by eye" is a thing a test can do rather than a thing a
 * reviewer must remember.
 *
 * Each action names the scopes it is charged against. `requestMagicLink` is
 * charged twice, per NFR26's own sentence — _"≤ 5/hour per address and ≤ 20/hour
 * per IP"_ — because either half alone leaves the obvious way round: an
 * address-only bound is defeated by rotating addresses, and an IP-only bound is
 * defeated by mobile data while tripping on a shared NAT.
 *
 * The four remaining ceilings — `sendOffer`, `reportOffer`, `createPhotoUpload`
 * and `changeEmail` — are NFR26's and arrive with the slices that can charge
 * them. The gated read arrived with story 5 and is **two** rows for one
 * requirement; its entry says why. Adding one is a row
 * here, a value in the `CHECK` on `rate_counter.action`, and a `rate limited`
 * row in the spec's UX state table. All three, or the ceiling is silent to the
 * person who hits it.
 */
export const CEILINGS = {
  requestMagicLink: {
    address: { max: 5, windowSeconds: 60 * 60 },
    ip: { max: 20, windowSeconds: 60 * 60 },
  },

  /**
   * **The Admin's second factor, bounded per Account** — two actions rather than
   * one, and the split is the requirement rather than a refinement of it.
   *
   * The bound these replace was Better Auth's: ten consecutive failures then
   * fifteen minutes, counted per account across factors, which went with the
   * plugin when the Admin door stopped being a credential path. DD5 is explicit
   * that the replacement is an NFR26 ceiling **scoped to the Account** and that a
   * per-IP bound is not an acceptable substitute — six digits against an
   * attacker who can rotate addresses is a matter of hours.
   *
   * **Same number, separate counters.** The number is the plugin's own, restated
   * rather than reconsidered; what is new is that exhausting one does not close
   * the other. That is what lets the door tell somebody who has mistyped six
   * digits ten times that a printed code still works — a sentence that is only
   * worth saying because it is true, and it is only true because these are two
   * rows.
   *
   * **Nothing charges them yet, and that is deliberate.** The door that reads a
   * code arrives in its own ticket; the enrolment that creates a factor to check
   * against arrives here. Both values have to exist in the `CHECK` on
   * `rate_counter.action` before the first charge, and that constraint is
   * generated from this registry — so a ceiling declared here is how the
   * migration gets written, and a literal in the constraint would be the second
   * spelling of this set that `inList` exists to prevent.
   */
  verifyAdminTotp: {
    account: { max: 10, windowSeconds: 15 * 60 },
  },
  verifyAdminBackupCode: {
    account: { max: 10, windowSeconds: 15 * 60 },
  },

  /**
   * **`publishProfile`, per Account and per IP** — NFR26's own row, and DD7's
   * answer to the first Worker-side abuse case: many profiles from throwaway
   * addresses, each with a zero Offer count, to sit on top of the browse
   * order. One profile per Account is the unique constraint's half; this is the
   * rate's half. The window is a calendar day rather than a rolling one, which
   * is what lets the refusal say when it resets.
   *
   * **A failed attempt is charged.** The action charges before its body runs,
   * so a submission the rejector refuses spends one of the three — which is the
   * case the seventh state exists for: a Worker who trips this after two
   * refusals meets a sentence rather than silence.
   */
  publishProfile: {
    account: { max: 3, windowSeconds: 24 * 60 * 60 },
    ip: { max: 3, windowSeconds: 24 * 60 * 60 },
  },

  /**
   * **`requestSkill`, per Account and per IP** — NFR26's own row, and the bound
   * on the one way a Worker can put a row in front of an Admin.
   *
   * What it protects is the scarcest resource in this design, which is one
   * person's attention (DD7): the vocabulary's way in is also a way to fill the
   * moderation queue with sentences nobody has to read before Offers stop being
   * reviewed inside their band. Five is generous against the honest case — she
   * is describing what she can do, and if it takes five phrasings the list is
   * what has the problem.
   *
   * **She meets this mid-publish**, which is what makes its refusal copy
   * different from every other one here: the ceiling refuses a request, not the
   * publish, so the sentence has to leave the form she is standing in usable.
   */
  requestSkill: {
    account: { max: 5, windowSeconds: 24 * 60 * 60 },
    ip: { max: 5, windowSeconds: 24 * 60 * 60 },
  },

  /**
   * **`updateProfile`, and deliberately not `publishProfile`'s three.**
   *
   * Publishing happens once, so three a day bounds a Worker-side abuse case at
   * no cost to anyone real. Editing is a repeated act by the same person on the
   * row she already owns: a Worker correcting her own wording three times would
   * be locked out of her own profile for a day by a number chosen to bound a
   * one-off. Ten a day is the shape `sendOffer` and `reportOffer` already use,
   * and the abuse it has to bound is smaller than publishing's — an edit mints
   * no row, takes no slug, and cannot put a second card on the Wall.
   *
   * **A refused save is charged**, as publishing's is: the action charges before
   * its body runs, so a submission the rejector refuses spends one of the ten.
   * That is the case the seventh state exists for.
   */
  updateProfile: {
    account: { max: 10, windowSeconds: 24 * 60 * 60 },
    ip: { max: 10, windowSeconds: 24 * 60 * 60 },
  },

  /**
   * **`sendOffer`, per Account and per IP** — NFR26's own row, and the bound on
   * the one way a Hirer can put work in front of both a Worker and the person
   * who reads every Offer before she does.
   *
   * It is the same ten `updateProfile` takes, and it protects two resources
   * rather than one: the reviewer's attention, which DD7 names as the scarcest
   * thing here, and a Worker's inbox. NFR7 bounds arrivals at 20 per rolling
   * hour across the whole platform, so a single Account able to send more than
   * ten in a day would be able to spend half of that band alone.
   *
   * **A refused send is charged**, as publishing's and editing's are: the action
   * charges before its body runs, so a submission the contact-detail rejector
   * refuses spends one of the ten. That is the case the seventh state exists
   * for, and the refusal says when he may send again.
   */
  sendOffer: {
    account: { max: 10, windowSeconds: 24 * 60 * 60 },
    ip: { max: 10, windowSeconds: 24 * 60 * 60 },
  },

  /**
   * **The harvesting ceiling, and the one entry in this registry that is two
   * rows for one requirement.** NFR26 bounds a gated profile read at _"≤ 60 per
   * Account per hour, ≤ 300 per day"_ — two windows against one principal, which
   * nothing else here needs.
   *
   * **The window is in the action name because the table's key cannot hold it.**
   * `rate_counter` is `UNIQUE (principal, action, window_start)`, and window
   * starts are aligned to the epoch: at midnight the hour-aligned and the
   * day-aligned start are the *same instant*, so two windows sharing one
   * `action` would charge one row and the day's 300 would silently become the
   * hour's 60 — once a day, at the hour a nightly job is most likely to run.
   * Widening that constraint means a `DROP CONSTRAINT` on a `UNIQUE`, which
   * NFR30's rule 3 counts destructive and requires to travel alone in a
   * `contract` migration; two actions cost one migration and no such trip.
   *
   * **What this ceiling is actually for is DD7's arithmetic**: it turns
   * enumerating the catalogue from a twenty-minute script into weeks, and into a
   * signal. It is not there to stop a Hirer reading profiles — 60 an hour is
   * more than anyone reads.
   *
   * **The per-IP numbers are 5× the Account bound and are this ticket's choice,
   * not NFR26's.** The requirement says only _"a higher per-IP bound above it"_
   * and never states one. 5× because the read needs a session and account
   * rotation is already bounded by `requestMagicLink`'s two ceilings, while a
   * shared NAT — a school, a café, an office in Pereira — may legitimately hold
   * a dozen readers, and a per-IP bound that trips on them would lock out the
   * exact population NFR26's own text warns about. Raising or lowering it is a
   * one-line change here.
   */
  readProfileHourly: {
    account: { max: 60, windowSeconds: 60 * 60 },
    ip: { max: 300, windowSeconds: 60 * 60 },
  },
  readProfileDaily: {
    account: { max: 300, windowSeconds: 24 * 60 * 60 },
    ip: { max: 1500, windowSeconds: 24 * 60 * 60 },
  },

  /**
   * **`createPhotoUpload`, per Account and per IP** — NFR26's own row, and the
   * one ceiling here that bounds a resource outside this process.
   *
   * What it protects is the bucket and the moderation queue at once. Each
   * charge mints a presigned PUT, and a presigned PUT is a write capability
   * for a stranger's object store: unbounded, a script that signs and uploads
   * in a loop fills 10 GB of R2's free tier and puts a `pending` row in front
   * of an Admin for every one of them, which is DD7's scarcest resource spent
   * by a crawler.
   *
   * **Ten a day is generous against the honest case and says so.** She picks a
   * photo, dislikes it, picks another — three or four is a real afternoon.
   * Ten is the shape `sendOffer` and `reportOffer` already use.
   *
   * **The refusal's copy is the one this ceiling is remembered for**, and the
   * acceptance criterion fixes its second half: it says the profile **is
   * already live without the photo**. Every other ceiling here refuses
   * something she was trying to do; this one refuses an addition to something
   * that already worked, and a sentence that left her thinking she had lost the
   * profile would be worse than the refusal.
   *
   * **A signed URL that is never used still spends one.** The charge is for the
   * capability rather than for the object, because the capability is what costs
   * — there is no way to know whether a PUT happened, and a ceiling that only
   * counted completed uploads would be defeated by not completing them.
   */
  createPhotoUpload: {
    account: { max: 10, windowSeconds: 24 * 60 * 60 },
    ip: { max: 10, windowSeconds: 24 * 60 * 60 },
  },
} as const satisfies Record<string, Partial<Record<CeilingScope, Ceiling>>>;

export type CeilingedAction = keyof typeof CEILINGS;

/**
 * The ceiling one action declares for one scope, or nothing.
 *
 * **A function rather than `CEILINGS[action][scope]`**, because the registry's
 * entries stopped having the same shape the moment a second ceiling was charged
 * against something other than an address: indexing the union of
 * `{ address, ip }` and `{ account }` by a `CeilingScope` is an error, correctly.
 * Widening to the type the registry already `satisfies` is what answers it, and
 * doing that here means one widening in this module rather than one at every
 * reader.
 */
export function ceilingFor(action: CeilingedAction, scope: CeilingScope): Ceiling | undefined {
  const scopes: Partial<Record<CeilingScope, Ceiling>> = CEILINGS[action];
  return scopes[scope];
}

/**
 * The registry's keys, as the array `#schema`'s `CHECK` on `rate_counter.action`
 * is written from — so the set the application validates against and the set the
 * engine enforces are one object rather than two spellings (see `inList` in
 * `#column-types`).
 */
export const CEILINGED_ACTIONS = Object.keys(CEILINGS) as readonly CeilingedAction[];

/**
 * How long a settled window's row is kept before {@link chargeCeiling} sweeps
 * it: twice the longest window any ceiling declares, so a row is only deleted
 * when no window that could still be charged can reach it.
 *
 * The sweep exists because nothing else deletes from `rate_counter` — without
 * it the table accretes one row per principal, action and window forever, and
 * a caller rotating principals mints a permanent row per request. Better Auth's
 * own limiter table prunes itself the same way, on the charge path.
 */
export const RATE_COUNTER_RETENTION_SECONDS =
  2 *
  Math.max(
    ...Object.values(CEILINGS).flatMap((scopes) =>
      Object.values(scopes).map((ceiling) => ceiling.windowSeconds),
    ),
  );

/**
 * Who a ceiling is charged against.
 *
 * `address` rather than `account` for the first one, because
 * `requestMagicLink` is charged **before** an Account exists — which is also why
 * `rate_counter.principal` is a `TEXT` key and not a foreign key.
 *
 * `account` arrives with the Admin's second factor, where it is the whole point:
 * DD5 rebuilds the plugin's per-account lockout as a ceiling and says in as many
 * words that a per-IP bound is not a substitute for it.
 */
export type CeilingScope = "address" | "ip" | "account";

export interface CeilingPrincipal {
  readonly scope: CeilingScope;
  /** The address, or the client IP. Hashed before it is stored — see {@link principalKey}. */
  readonly id: string;
}

/** Allowed, or refused with everything the surface needs to say so. */
export type CeilingOutcome =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      /** Seconds until the window resets. What the surface renders (NFR26, C39). */
      readonly retryAfter: number;
      /** For the log line and the operator. Returned, never thrown. */
      readonly error: AppError;
    };

/**
 * The stored key.
 *
 * **The address is hashed, and the hash is unsalted on purpose.** A rate counter
 * is a count, not a record: it never needs to be read back as an address, so
 * storing one would put `personal` data in a table with no retention rule in
 * NFR17 and no reason to hold it. A salt would buy resistance to enumeration by
 * someone who already has the database — and someone with the database has
 * `user.email` in the clear beside it, so the salt would protect nothing while
 * adding a secret whose rotation resets every ceiling in the system.
 *
 * Lower-cased before hashing so `Ana@…` and `ana@…` charge one counter, matching
 * the `citext` column the same address is stored in.
 */
export function principalKey({ scope, id }: CeilingPrincipal): string {
  const digest = createHash("sha256").update(id.trim().toLowerCase()).digest("hex");
  return `${scope}:${digest}`;
}

/**
 * The window this instant falls in — fixed windows aligned to the epoch, not a
 * sliding one.
 *
 * A sliding window is more accurate and needs a row per event; a fixed window
 * needs one row per principal per window and is what the `UNIQUE (principal,
 * action, window_start)` constraint on `rate_counter` is shaped for. The cost is
 * stated rather than hidden: a person can spend a full allowance at the end of
 * one window and a second full allowance at the start of the next. For
 * `requestMagicLink` that is ten emails in a couple of minutes rather than five,
 * which bounds the abuse case NFR26 names — a flood of mail to an address that
 * did not ask for it — closely enough to be worth one row instead of five.
 */
export function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** Seconds from `now` until the window holding it resets. Always at least 1. */
export function retryAfterFor(now: Date, windowSeconds: number): number {
  const windowStart = windowStartFor(now, windowSeconds);
  const resetsAt = windowStart.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000));
}

/**
 * _"en 12 minutos"_ — the phrase the refusal ends on, in `es-CO`.
 *
 * Do 4 of the voice guide wants the product's own evidence quoted back, and
 * Don't 4 refuses _más tarde_ for exactly this: an ambiguous refusal is a
 * refusal she cannot plan around. Minutes rather than a clock time because the
 * server's clock and her phone's are not the same clock, and _"a las 3:40 p. m."_
 * asserts an agreement between them that does not exist.
 */
export function retryPhrase(retryAfter: number): string {
  if (retryAfter < 60) return "en menos de un minuto";

  const minutes = Math.ceil(retryAfter / 60);
  if (minutes < 60) return `en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.ceil(minutes / 60);
  return `en ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

/**
 * The one string a person reads when a ceiling refuses her, **per action**.
 *
 * Refusal tone, per the voice guide's matrix: Optimism 3→4, Energy 2→1, Warmth 5
 * unchanged — _"the refusal is our rule, never her mistake"_. Each is at most
 * three sentences, each under twenty words: what our rule is with her count in
 * it, when it changes, and — where there is one — the door that is still open.
 *
 * **The scope is a parameter because the count is only hers on one of them.**
 * Every ceiling written before the gated read bounded both principals at the
 * same number, so the sentence read the same either way and nothing needed to
 * know which one refused. `readProfileHourly` is the first entry where the two
 * differ, and quoting a per-IP maximum to the person who tripped it says
 * _"Abriste 300 perfiles"_ to somebody who opened five behind a shared
 * connection — a sentence she can catch being wrong, which is the failure Don't
 * 4 names and the one thing this table's own copy rules say to avoid. An entry
 * whose two bounds are equal may ignore the argument; `rate-limit.test.ts`
 * refuses one where they are not.
 *
 * **It is a `Record` over the action union rather than one sentence for every
 * ceiling**, and it stopped being one sentence the moment a second ceiling
 * existed. `requestMagicLink`'s copy names links and offers Google; rendering
 * that to an Admin who mistyped a code would be a refusal about something that
 * did not happen, which is the failure Don't 4 is about. The `Record` is what
 * makes the next ceiling's copy a compile error rather than a silently borrowed
 * sentence — the same mechanism `ADMIN_ACTION_HANDLERS` uses over its own
 * registry.
 */
/**
 * The two public surfaces, named as the product names them to a reader.
 *
 * `"las listas"` was what this said first, and it named nothing anybody had
 * seen: the two surfaces are *el muro* — `CONTEXT.md` fixes the Wall's Spanish —
 * and *Todos los perfiles*, whose own empty state already calls itself *la
 * lista*. The voice guide's sentence rules refuse a sentence only somebody who
 * already knows the product can parse, and a plural naming neither surface was
 * one.
 */
/**
 * **What a refusal says when the principal that tripped it is a connection.**
 *
 * `ip` is the only scope in {@link CEILINGS} that is not one person, so it is
 * the only one where quoting a count back is a claim about somebody else. Every
 * `ip`-scoped entry opens with its own verb and then this clause: what happened,
 * and why it may not have been her. The alternative — one sentence shared by all
 * six — would have had to drop the verb, and "Se hicieron muchas acciones" is
 * the vagueness Don't 4 refuses.
 */
const SHARED_CONNECTION = "desde tu conexión a internet, que puede ser compartida";

const OTHER_DOORS_OPEN = "el muro y la lista de perfiles siguen abiertos";

export const CEILING_REFUSALS: Record<
  CeilingedAction,
  (ceiling: Ceiling, retryAfter: number, scope: CeilingScope) => string
> = {
  /**
   * The last sentence is the spec's own requirement for this surface — _"the
   * Google door is still there"_ — and it is why a rate-limited sign-in is not a
   * dead end.
   */
  requestMagicLink: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se pidieron muchos enlaces ${SHARED_CONNECTION}. `
      : `Pediste ${ceiling.max} enlaces en una hora, que es el máximo. `) +
    `Puedes pedir otro ${retryPhrase(retryAfter)}. ` +
    "Mientras tanto, puedes entrar con Google.",

  /**
   * **The third sentence arrived with the door**, which is where it was left
   * when this entry was written with two. It names the way through rather than
   * a second door, and it is true precisely because these two ceilings count
   * separately: exhausting the six digits leaves the ten printed codes
   * untouched, so an Admin locked out of the authenticator is not locked out of
   * the platform.
   *
   * **It says "de respaldo", which is the name she has already met.** The
   * enrolment screen headed them _"Tus códigos de respaldo"_ and gave her a copy
   * button rather than a print one, so a lockout that told her to find something
   * "impreso" would name a thing nobody asked her to make — and would be the one
   * word in this product that only its authors can resolve.
   */
  verifyAdminTotp: (ceiling, retryAfter) =>
    `Escribiste ${ceiling.max} códigos incorrectos, que es el máximo. ` +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}. ` +
    "Si guardaste un código de respaldo, ese sí funciona.",

  /**
   * **Two sentences, and the third is deliberately absent here.** Its mirror
   * image would send the reader back to the authenticator, which is where she
   * already failed — someone typing printed codes is someone whose phone is
   * gone. Naming a door she cannot reach is Don't 4, so this one stops at when.
   */
  verifyAdminBackupCode: (ceiling, retryAfter) =>
    `Escribiste ${ceiling.max} códigos de respaldo incorrectos, que es el máximo. ` +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}.`,

  /**
   * `docs/policy/voice.md`'s own before/after for this ceiling, example 2: the
   * count is quoted back (Do 4), what to do next is in the same breath (Do 3),
   * and the last sentence is the one the spec's seventh state names — _that
   * nothing she typed was lost_. "Intentaste" rather than "publicaste", because
   * the count includes the attempts the rejector refused, and a sentence that
   * told her she had published three times would be false.
   */
  publishProfile: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se intentó publicar muchas veces hoy ${SHARED_CONNECTION}. `
      : `Intentaste publicar ${ceiling.max} veces hoy, que es el máximo. `) +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}. ` +
    "Nada de lo que escribiste se perdió: sigue aquí.",

  /**
   * **The one refusal in this table that is read by somebody in the middle of
   * something else**, and the spec singles it out for that: she is mid-publish
   * when she meets it, which is the moment silence costs the most.
   *
   * Three sentences, and the middle one is the load-bearing one. A ceiling on a
   * request she has already sent five of reads, with nothing said, as *the five
   * went nowhere* — so the second sentence says where they went. The third
   * leaves the form usable rather than sending her away from it: the closest
   * entry on the list is a real answer today, and it is the only next step that
   * does not depend on an Admin.
   *
   * It stopped there deliberately. The obvious fourth clause — publish now and
   * change it once the Skill is added — named something this product had no way
   * to do: editing a published CapabilityProfile had no action and no surface.
   * A refusal that promised one would have been the dead end the picker's own
   * "not on the list" option was written to avoid, one turn further in.
   *
   * **Editing exists now**, so the reason above no longer holds and adding that
   * clause is a copy decision nobody has taken. What editing did force is the
   * other half: the picker is on the edit form too, so the sentence no longer
   * ends in *y publica* — a Worker changing a profile she published weeks ago
   * cannot publish it again, and telling her to would name an act she has no way
   * to take. Leaving her the form she is standing in, which is what that clause
   * was for, *escoge la más parecida* still does.
   */
  requestSkill: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se pidieron muchas capacidades hoy ${SHARED_CONNECTION}. `
      : `Pediste ${ceiling.max} capacidades hoy, que es el máximo. `) +
    "Las que enviaste quedaron en la fila: siguen ahí. " +
    `Puedes pedir otra ${retryPhrase(retryAfter)}; ahora escoge la más parecida.`,

  /**
   * **The third sentence is this ceiling's own, and it is the reassurance
   * publishing's cannot give.** She already has a profile; what she needs to
   * know is not only that her typing survived the refusal but that the version
   * strangers can see right now is a whole one — the last save that succeeded,
   * never a half-applied edit. The write is one transaction, so that sentence is
   * true by construction rather than by hope.
   *
   * "Guardar" rather than "editar", because that is the word on the control she
   * pressed, and a refusal that names a different act than the one she took
   * reads as a refusal about something else.
   */
  updateProfile: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se guardaron muchos cambios hoy ${SHARED_CONNECTION}. `
      : `Guardaste cambios ${ceiling.max} veces hoy, que es el máximo. `) +
    `Puedes guardar otra vez ${retryPhrase(retryAfter)}. ` +
    "Nada de lo que escribiste se perdió, y tu perfil sigue como lo guardaste la última vez.",

  /**
   * **The Hirer's ceiling, and the one refusal in this table addressed to him.**
   *
   * The voice guide's tone matrix drops Warmth to 3 for a Hirer writing an Offer
   * and holds Directness at 5, so this is the plainest entry here: his count, the
   * wait, and the one thing he actually wants to know — that the Offers already
   * sent are on their way to a person who will read them, and that nothing he
   * typed was thrown away.
   *
   * **It says what happened to the Offers he already sent, because that is the
   * question a ceiling raises.** A Hirer who meets this after nine sends has nine
   * Offers in a queue and no way to see them from here; a refusal that named only
   * the wait would leave him to guess whether the tenth attempt undid any of it.
   */
  sendOffer: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se enviaron muchas propuestas hoy ${SHARED_CONNECTION}. `
      : `Enviaste ${ceiling.max} propuestas hoy, que es el máximo. `) +
    `Puedes enviar otra ${retryPhrase(retryAfter)}. ` +
    "Las que ya enviaste siguen su curso y nada de lo que escribiste se perdió.",

  /**
   * **The only two refusals here written for somebody who may be an attacker**,
   * and they are the plainest in the table for exactly that reason. NFR26's own
   * words are that the reply is _the honest one_ — reading paused, and when it
   * resumes — _"since a harvester learns nothing he did not already know from
   * being stopped"_. Vagueness would buy nothing against him and would cost the
   * Hirer who was simply reading a real answer.
   *
   * **"Abriste", not "Leíste".** Every read charges, whether or not he read a
   * word, and a sentence claiming to know he read them is a sentence he can
   * catch being wrong. It also matches `publishProfile`'s "Intentaste", which is
   * that entry's own reason.
   *
   * **The per-IP sentence drops the count, and that is the same rule applied
   * once more rather than an exception to it.** These are the first two ceilings
   * whose two bounds differ — 60 against 300 — so they are the first where
   * `ceiling.max` is not necessarily hers. The per-IP bound exists for the
   * shared connection this file argues for above, a school or a café or an
   * office in Pereira; telling the twelfth reader on it that *she* opened 300
   * profiles is exactly the sentence she can catch being wrong. So the per-IP
   * half says what happened, names the shared connection as the likely cause,
   * and quotes no number that is not hers. Do 4 asks for the product's evidence
   * quoted back; a count belonging to somebody else is not evidence about her.
   *
   * The third sentence names the door that is still open, as
   * `requestMagicLink`'s does: the Wall and the browsable list are public and
   * carry no ceiling at all, so nobody who meets this is shut out of the
   * product.
   */
  readProfileHourly: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se abrieron muchos perfiles ${SHARED_CONNECTION}. `
      : `Abriste ${ceiling.max} perfiles en una hora, que es el máximo. `) +
    `Puedes seguir abriendo perfiles ${retryPhrase(retryAfter)}. ` +
    `Mientras tanto, ${OTHER_DOORS_OPEN}.`,

  readProfileDaily: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se abrieron muchos perfiles hoy ${SHARED_CONNECTION}. `
      : `Abriste ${ceiling.max} perfiles hoy, que es el máximo. `) +
    `Puedes seguir abriendo perfiles ${retryPhrase(retryAfter)}. ` +
    `Mientras tanto, ${OTHER_DOORS_OPEN}.`,

  /**
   * **The third sentence is what #18's acceptance criterion asks for, with one
   * word changed — and the word is the whole finding.**
   *
   * The criterion asks that the refusal say the profile _"is already live
   * without the photo"_, and that was written imagining `/my-profile`, where it
   * is simply true. The first caller is `/publish`, where the ceiling is met
   * **before any profile exists** — so the sentence promised her something
   * findable that she had not made yet, which is precisely the "sentence she can
   * catch being wrong" the voice guide refuses.
   *
   * So it says the thing that is true on both surfaces instead: the photo is not
   * what the profile depends on. It is still the only ceiling here whose last
   * sentence is reassurance rather than a refusal — every other one refuses a
   * thing she was trying to do, and this one refuses an *addition*, so a
   * sentence that left her thinking she had lost the rest would be worse than
   * the refusal itself. The voice guide's own banned construction — _"tu perfil
   * está en revisión"_ — is the same confusion said the other way round.
   */
  createPhotoUpload: (ceiling, retryAfter, scope) =>
    (scope === "ip"
      ? `Se intentaron muchas fotos hoy ${SHARED_CONNECTION}. `
      : `Intentaste poner una foto ${ceiling.max} veces hoy, que es el máximo. `) +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}. ` +
    "La foto es opcional y tu perfil no depende de ella.",
};

/**
 * Charge one ceiling and say whether the action may proceed.
 *
 * **The handle is the first parameter**, ahead of ADR-0010's principal. See
 * `#database` for why, and for the shape every later query module copies.
 *
 * One statement, and it is an upsert rather than a read-then-write: two
 * statements race, and the race is won by the caller sending the flood this
 * exists to bound.
 */
export async function chargeCeiling(
  db: DomainDatabase,
  principal: CeilingPrincipal,
  action: CeilingedAction,
  now: Date = new Date(),
): Promise<CeilingOutcome> {
  const ceiling = ceilingFor(action, principal.scope);

  // An action charged against a scope it declares no ceiling for is not
  // "unlimited", it is a caller asking the wrong question. Allowing is the only
  // answer that is not a lie, and the registry is what a reviewer checks.
  if (!ceiling) return { allowed: true };

  const windowStart = windowStartFor(now, ceiling.windowSeconds);

  const [row] = await db
    .insert(rateCounter)
    .values({ principal: principalKey(principal), action, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateCounter.principal, rateCounter.action, rateCounter.windowStart],
      set: { count: sql`${rateCounter.count} + 1` },
    })
    .returning({ count: rateCounter.count });

  // The sweep. On the charge path rather than a scheduler, because a counter
  // that is being charged is the one moment the table is guaranteed to have a
  // caller paying attention — and charges are bounded by the ceilings
  // themselves, so the extra statement is bounded with them.
  await db
    .delete(rateCounter)
    .where(
      lt(rateCounter.windowStart, new Date(now.getTime() - RATE_COUNTER_RETENTION_SECONDS * 1000)),
    );

  // `RETURNING` on an upsert that matched or inserted always yields one row, so
  // no row means the statement did something this code does not model. Failing
  // closed is the rule (NFR26); a missing row is not permission.
  const count = row?.count;
  if (count === undefined) {
    throw new AppError({
      code: "rate_counter_write_failed",
      status: 503,
      message:
        `Charging the ${action} ceiling returned no row, so the count is unknown and the ` +
        "action must not proceed. This counter fails closed.",
      userMessage: SERVICE_UNAVAILABLE,
      context: { action, scope: principal.scope },
    });
  }

  if (count <= ceiling.max) return { allowed: true };

  const retryAfter = retryAfterFor(now, ceiling.windowSeconds);

  return {
    allowed: false,
    retryAfter,
    error: new AppError({
      code: "rate_limited",
      status: 429,
      message:
        `The ${action} ceiling refused a request: ${count} charges against a ${principal.scope} ` +
        `principal in a ${ceiling.windowSeconds}s window, over the ceiling of ${ceiling.max}.`,
      userMessage: CEILING_REFUSALS[action](ceiling, retryAfter, principal.scope),
      /**
       * **Counts and enum values only — and deliberately no principal at all.**
       *
       * An earlier version put the hashed principal here, on the argument that a
       * hash is not an address. That argument covers the row at rest and does
       * *not* cover this field: `context` reaches the log line, NFR18 allows
       * **0** lines carrying an email address, and an unsalted digest of one is
       * a stable identifier an attacker holding the log can confirm a guess
       * against. It also bought an operator nothing they could act on, since
       * they cannot reverse it either.
       *
       * What is left is what a refusal is actually about: which ceiling, how far
       * over, and when it resets.
       */
      context: {
        action,
        scope: principal.scope,
        count,
        max: ceiling.max,
        // `snake_case` on the line, whatever the source calls it (ADR-0005).
        // The refusal's own `retryAfter` stays camelCase: that one is a
        // TypeScript field a surface reads, not a field on a log line.
        retry_after: retryAfter,
      },
    }),
  };
}

/**
 * **The pooled bindings: what a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass — which
 * is the one place the handle-first rule cannot be literal. The binding is one
 * line, and the function it binds is the one seam 2 exercises against PGlite.
 * This is the shape `./offers`, `./exchange`, `./moderation` and `./export`
 * copy.
 *
 * **Named `ceilings` rather than `rateLimit`**, because `@repo/domain` already
 * exports a `rateLimit` — Better Auth's own limiter table, re-exported through
 * `#schema` for its adapter. Two unrelated things under one name in one package
 * is a collision waiting for the first reader who greps. These ceilings are
 * NFR26's and they count in `rate_counter`; that table is Better Auth's and it
 * counts `/api/auth/*`.
 *
 * **The import is dynamic here and static in every other facade, and this is the
 * one module where that is a reason rather than a habit.** `#auth/config`
 * imports `chargeCeiling` from this file, and `admin/enrol-cli.ts` imports
 * `#auth/config` — so this module is on the import graph of a command that runs
 * as plain `node`, which sets no `react-server` condition and therefore cannot
 * load `#connection` at all. Measured, both ways: static here, and
 * `pnpm admin:enrol` dies before printing its usage line; dynamic, and it prints
 * a setup link.
 *
 * What the dynamic import keeps out of which graph, stated plainly: it keeps
 * `#connection` — the `server-only` marker, and `@repo/observability`, whose
 * `@sentry/nextjs` dependency has no named exports under plain `node` — off the
 * enrolment command's graph. Not `pg`: that command opens the **direct**
 * connection itself and imports `pg` either way. Every other facade in this
 * package is reached only from a request path and imports the handle statically.
 */
export const ceilings = {
  async charge(principal: CeilingPrincipal, action: CeilingedAction): Promise<CeilingOutcome> {
    const { db } = await import("#connection");
    return chargeCeiling(db(), principal, action);
  },
};
