/**
 * Every string the Admin surfaces render, in `es-CO`.
 *
 * **The Admin is a person and `docs/policy/voice.md` binds this file too.** It is
 * tempting to treat an internal tool as exempt — it has one reader, who is also
 * the operator — and the guide's own answer is that a rule you cannot fail is not
 * a rule. What *does* change is the register: the Wall speaks to a Worker who may
 * be meeting the product for the first time, and this speaks to someone working a
 * queue top to bottom, daily, at speed. So Directness sits at 5 throughout, Energy
 * drops, and nothing here explains what the queue is.
 *
 * **The boundary rule still applies, one step removed.** The care is directed at
 * the process, never at the person — and on these screens the people being
 * described are the Workers and Hirers in the queue, who are not reading. That is
 * exactly when the guard slips, so the vocabulary here is `CONTEXT.md`'s (a
 * Report, an Offer, an Account) and never a word about what anybody lost.
 *
 * English identifiers, Spanish values (ADR-0012).
 */

/** The tab, and the heading. */
export const ADMIN_PAGE_TITLE = "Fila — Recomencemos";
export const ADMIN_TITLE = "Fila";

/**
 * The refusal, for a page and for an action alike.
 *
 * **One sentence for every caller it can meet** — signed out, a Worker, an Admin
 * on a magic-link session, an Admin whose session has expired. NFR14 answers 403
 * rather than redirecting so that an unauthenticated caller does not learn the
 * route is worth attacking; a sentence per case would hand that back by letting a
 * caller work out which one they are.
 *
 * It offers no route onward, and that is the same decision: a way onward on a page
 * anyone can reach is a sign saying the door is here. The Admin knows where the
 * door is.
 */
export const ADMIN_SESSION_REQUIRED = "No tienes acceso a esta página.";

/**
 * The empty queue.
 *
 * **It is a good state and the copy has to say so**, which is the acceptance
 * criterion in as many words. A queue at zero means every Offer has been read and
 * nobody is waiting behind NFR7's 24-hour band — the best this screen can report.
 * The default empty state ("no hay nada") reads as an absence of data, which on
 * this surface would be indistinguishable from a source that failed to load.
 */
export const QUEUE_EMPTY_TITLE = "La fila está vacía.";
export const QUEUE_EMPTY_BODY = "No hay nada esperando revisión.";

/**
 * The age of the oldest item, which renders before anything else (story 7) —
 * because it is the number NFR7 is measured on, and the one that decides whether
 * today is an ordinary day.
 *
 * **Zero renders as zero**, which the acceptance criterion asks for outright:
 * _"queue empty … says the oldest-item age is zero"_. A first draft replaced it
 * with a sentence, on the argument that a set with no members has no age. True,
 * and beside the point — this is a health figure read against NFR7's 24-hour
 * band, and 0 is the good value an Admin scans for. A sentence where a number
 * belongs breaks the scan.
 */
export const OLDEST_ITEM_LABEL = "Lo más antiguo";

/** `19 h`. The unit is the one NFR7 states the requirement in. */
export const oldestItemHours = (hours: number) => `${hours} h`;

/**
 * A source that failed to load, named.
 *
 * **The name is the requirement**, not decoration: _"a source failed: say which,
 * because a silently missing source is an unreviewed Offer"_. A generic "algo
 * falló" on a screen whose whole job is completeness would let the Admin work a
 * queue that is quietly short of one branch, and conclude the queue was empty.
 */
export const sourceFailed = (source: string) =>
  `No pudimos cargar ${source}. Puede haber elementos sin revisar aquí.`;

/** The panel that ends an Account's sessions (NFR13). */
export const SESSIONS_HEADING = "Cerrar sesiones de una cuenta";
export const SESSIONS_EXPLANATION =
  "Cierra todas las sesiones abiertas de una cuenta. Queda registrado quién lo hizo y cuándo.";
export const SESSIONS_EMAIL_LABEL = "Correo de la cuenta";
export const SESSIONS_SUBMIT = "Cerrar sesiones";
export const SESSIONS_SUBMITTING = "Cerrando…";

/**
 * What the Admin is told afterwards — the count quoted back, which is voice guide
 * Do 4 and the same shape `/account` uses for `signOutEverywhere`.
 *
 * Zero has its own sentence: "Cerramos 0
 * sesiones" is arithmetic, and what the Admin needs to know is that the Account
 * was found and had none open — which is a different fact from the action failing.
 */
export const sessionsRevoked = (count: number) =>
  count === 0
    ? "Esa cuenta no tenía sesiones abiertas."
    : `Cerramos ${count} ${count === 1 ? "sesión" : "sesiones"}.`;

/**
 * The address field's own refusal, on the queue's sessions panel.
 *
 * Short, because the one person reading it knows what an address looks like and a
 * form that explains an email address to its own author is a form talking to
 * nobody. It replaces Zod's English (ADR-0012), which is the only reason it is a
 * string rather than a default.
 */
export const ADDRESS_LOOKS_WRONG = "Escribe un correo válido.";

/**
 * The Skill requests branch.
 *
 * **The heading names what is waiting rather than what to do to it**, like every
 * other source: an Admin scanning five headings is reading a list of backlogs.
 */
export const SKILL_REQUESTS_LABEL = "Capacidades pedidas";

/**
 * Promoting one. Two fields, and their help says what each is *for*, because the
 * distinction between them is the one thing an Admin can get wrong here and the
 * only thing this form has to teach.
 *
 * **The identifier is English and the name is Spanish** (ADR-0012), and the help
 * says so in the terms of what each is used for rather than by naming a rule: one
 * travels in a link, one is read on the form. An Admin who reads only the labels
 * still gets it right.
 */
export const PROMOTE_HEADING = "Agregar al listado de capacidades";
export const PROMOTE_SLUG_LABEL = "Identificador";
export const PROMOTE_SLUG_HELP = "En inglés, con guiones. Viaja en los enlaces de búsqueda.";
export const PROMOTE_LABEL_LABEL = "Nombre que se lee";
export const PROMOTE_LABEL_HELP =
  "En español, como lo diría ella. Es lo que aparece en el formulario.";
export const PROMOTE_CUOC_LABEL = "Código CUOC (opcional)";
export const PROMOTE_CUOC_HELP = "Si la capacidad corresponde a una ocupación de la CUOC.";
export const PROMOTE_SUBMIT = "Agregar";
export const PROMOTE_SUBMITTING = "Agregando…";

/** The identifier's own rules, as refusals rather than as instructions. */
export const PROMOTE_SLUG_REQUIRED = "Escribe el identificador en inglés.";
export const PROMOTE_SLUG_SHAPE = "Solo minúsculas, números y guiones.";
export const PROMOTE_LABEL_REQUIRED = "Escribe el nombre que se va a leer.";
export const PROMOTE_LABEL_TOO_LONG = "Acórtalo: hasta 80 caracteres.";
export const PROMOTE_CUOC_SHAPE = "El código CUOC tiene cinco dígitos.";

/**
 * What the Admin is told afterwards: the entry, quoted back.
 *
 * **The label rather than a count**, because one promotion is one entry and the
 * thing worth confirming is *which words* are now in front of every Worker on the
 * publishing form — the Admin typed them a moment ago and this is the only place
 * they are read back.
 */
export const skillPromoted = (labelEs: string) => `Agregamos «${labelEs}» al listado.`;

/** When the request arrived, so an Admin can see what is oldest without arithmetic. */
export const requestedOn = (at: Date) =>
  `Pedida el ${at.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}`;
