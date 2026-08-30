/**
 * Who the *responsable del tratamiento* is, and where a *consulta* or a
 * *reclamo* reaches them.
 *
 * Ley 1581 requires both by name in the *aviso de privacidad*, and
 * [intent Q4](../../../docs/efforts/0002-profile-to-contact-exchange/intent.md)
 * records that the operator personally is that person — accepted knowingly, with
 * the personal liability that carries. Go-live runbook §7 is where the
 * obligation lives.
 *
 * **It is deployment configuration rather than committed copy, and the reason is
 * not privacy theatre.** A legal name and a mailbox that answers a *reclamo* are
 * one person's real identity; a public repository is not where they belong, and
 * neither is a formatter's diff every time the address changes.
 * `NOTIFICATIONS_FROM` and `BETTER_AUTH_URL` already establish the shape — a
 * non-credential runtime value in `globalPassThroughEnv`, with a development
 * value in `.env.example`.
 *
 * **What stops it reaching production unfilled is a mechanism rather than a
 * note.** `senderIdentity()` throws rather than invent a sender and `authSecret`
 * refuses its own development value under `NODE_ENV=production`; this does both.
 * A deploy with either variable unset, or still carrying the placeholder, fails
 * at the first render of `/privacy` — which is loud, and is the alternative to a
 * privacy notice that goes live naming nobody.
 *
 * **There is no `import "server-only"` here, and that is a decision.** The marker
 * is unresolvable outside a bundler, so it would take the production branch —
 * the one thing in this file worth guarding — out of reach of any test: seam 3
 * runs a `next dev`, where `NODE_ENV` is `development` by definition. What stands
 * in its place is stronger than a convention and weaker than a build error, and
 * it is worth naming precisely. Neither variable is `NEXT_PUBLIC_`, so Next
 * replaces both with `undefined` in a client bundle while inlining `NODE_ENV` as
 * `"production"` — so a Client Component that imported this would **throw on
 * render in production** rather than quietly render a placeholder. That is the
 * failure mode `server-only` exists to prevent, arriving one stage later.
 *
 * The `env` parameter is `@repo/notifications/config.ts`'s idiom, and it is what
 * lets `responsible-party.test.ts` drive both branches without stubbing a global.
 */

import { AppError } from "@repo/errors/app-error";
import { NOTICE_UNAVAILABLE } from "@/app/_lib/consent/messages";

const NAME_VARIABLE = "RESPONSIBLE_PARTY_NAME";
const EMAIL_VARIABLE = "RESPONSIBLE_PARTY_EMAIL";

/**
 * The values `.env.example` ships, and the two strings this module refuses to
 * serve in production.
 *
 * They are named here rather than only in `.env.example` because the check is
 * what makes them safe to commit: a placeholder nothing recognises is just a
 * wrong answer that deploys quietly.
 */
export const RESPONSIBLE_PARTY_PLACEHOLDERS = {
  name: "Responsable de desarrollo",
  email: "datos@localhost",
} as const;

export interface ResponsibleParty {
  readonly name: string;
  readonly email: string;
}

/** Only the three keys this module reads, so a test hands it three strings. */
export type ResponsiblePartyEnv = Partial<
  Record<typeof NAME_VARIABLE | typeof EMAIL_VARIABLE | "NODE_ENV", string>
>;

function read(env: ResponsiblePartyEnv, variable: string, placeholder: string): string {
  const inProduction = env.NODE_ENV === "production";
  const value = env[variable as keyof ResponsiblePartyEnv]?.trim();

  if (!value) {
    if (inProduction) throw unset(variable, "is unset or empty");
    return placeholder;
  }

  if (value === placeholder && inProduction) {
    throw unset(variable, "still carries the development placeholder");
  }

  return value;
}

/**
 * **503 rather than 500**, because it is a configuration gap and not a fault: the
 * deploy is missing a value a person can set, and the request would succeed once
 * they do.
 *
 * The `message` names the variable and the runbook step, which is the only thing
 * an operator reading this at 3am can act on. Neither value is a credential, so
 * neither needs the redaction care `resendApiKey` takes — but the message still
 * names the variable rather than quoting what it holds, because a legal name is
 * `personal` and a log line is not the place for one.
 */
function unset(variable: string, problem: string): AppError {
  return new AppError({
    code: "responsible_party_unset",
    status: 503,
    message:
      `${variable} ${problem}, so the privacy notice cannot name the person legally ` +
      "answerable for this data. Set it with `fly secrets`; see " +
      "docs/runbooks/recomencemos-go-live.md §7.",
    userMessage: NOTICE_UNAVAILABLE,
    context: { variable },
  });
}

/**
 * The *responsable*, for the one page that has to name them.
 *
 * Read per render rather than memoised: it is two lookups, and a cached value
 * would survive a `fly secrets set` that was meant to correct it.
 */
export function responsibleParty(env: ResponsiblePartyEnv = process.env): ResponsibleParty {
  return {
    name: read(env, NAME_VARIABLE, RESPONSIBLE_PARTY_PLACEHOLDERS.name),
    email: read(env, EMAIL_VARIABLE, RESPONSIBLE_PARTY_PLACEHOLDERS.email),
  };
}
