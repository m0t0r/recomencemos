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

/** One section's tab. The heading is the section's own label. */
export const sectionPageTitle = (label: string) => `${label} — Fila — Recomencemos`;

/**
 * The five section names.
 *
 * **`CONTEXT.md`'s vocabulary, not a synonym of it** — an Offer is a _Propuesta_
 * and a Report is a _Reporte_, and the glossary's `_Avoid_` lists exist because
 * a queue that calls the same thing two names is a queue whose operator has to
 * translate before deciding.
 *
 * **Each names what is waiting rather than what to do to it.** An Admin scanning
 * five nav items is reading a list of backlogs, not a list of verbs.
 */
export const OFFERS_LABEL = "Propuestas";
export const PHOTOS_LABEL = "Fotos";
export const REPORTS_LABEL = "Reportes";
export const BOUNCES_LABEL = "Correos rebotados";

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
 * A section with nothing waiting.
 *
 * **It is a good state and the copy has to say so**, which is the acceptance
 * criterion in as many words. A section at zero means everything in it has been
 * read and nobody is waiting behind the band — the best this screen can report.
 * The default empty state ("no hay nada") reads as an absence of data, which on
 * this surface would be indistinguishable from a source that failed to load.
 *
 * **The body states the age as zero**, which the criterion asks for outright:
 * _"a real and good state, saying the oldest-item age is zero"_. The figure in
 * the shell says the same thing about the whole queue; this says it about the
 * section the Admin is looking at, which is the one they are deciding about.
 */
export const QUEUE_EMPTY_TITLE = "Aquí no hay nada esperando.";
export const QUEUE_EMPTY_BODY = "Todo está revisado: lo más antiguo en esta sección es 0 h.";

/**
 * A section whose story has not landed.
 *
 * **It is not the empty state and must never read as one.** Zero means everything
 * was read; this means nothing was ever asked. Saying "no hay nada" here would be
 * the instrument that lies — an Admin would conclude the branch was clear when it
 * is not being counted at all, which is the unreviewed Offer this whole surface
 * exists to prevent. So the copy says what is true: there is no count and no
 * antiquity to show, because nothing is being recorded yet.
 *
 * It is temporary by construction and leaves with the section that replaces it.
 */
export const SECTION_NOT_LIVE_TITLE = "Esta sección todavía no está funcionando.";
export const SECTION_NOT_LIVE_BODY =
  "Todavía no estamos guardando nada aquí, así que no hay cuenta ni antigüedad que mostrar. " +
  "No quiere decir que esté vacía.";

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
export const OLDEST_ITEM_LABEL = "Lo más antiguo en la fila";

/** `19 h`. The unit is the one NFR7 states the requirement in. */
export const oldestItemHours = (hours: number) => `${hours} h`;

/**
 * The nav, and the control that hides it.
 *
 * **The toggle's name says what it does to the sections, not "sidebar".** The
 * person reading it is looking for their work, and the registry's own word for
 * the element is not a word anybody here would use.
 */
export const QUEUE_NAV_LABEL = "Secciones de la fila";
export const QUEUE_NAV_GROUP_LABEL = "Secciones";
export const SIDEBAR_TOGGLE_LABEL = "Mostrar u ocultar las secciones";
export const SIDEBAR_MOBILE_TITLE = "Secciones de la fila";
export const SIDEBAR_MOBILE_DESCRIPTION = "Las cinco secciones, con lo que espera en cada una.";

/**
 * How much is waiting in one section, announced.
 *
 * **The number alone is what a sighted Admin scans and is not enough on its
 * own** — read out, "Propuestas, 12" is a list position as easily as a backlog.
 * The visible figure is `aria-hidden` and this is what is announced beside the
 * name, which is one fact rendered twice rather than two facts that can drift.
 */
export const sectionWaiting = (total: number) =>
  `${total} ${total === 1 ? "pendiente" : "pendientes"}`;

/** A section with no resolver has no figure, and the dash is not a zero. */
export const SECTION_NOT_LIVE_SHORT = "—";
export const SECTION_NOT_LIVE_ANNOUNCEMENT = "todavía sin datos";

/**
 * A section whose oldest item has passed its band.
 *
 * **Text, not a colour**, which is the acceptance criterion and WCAG 2.2 AA's
 * 1.4.1 in the same sentence: the marker is a word an Admin reads and a screen
 * reader announces, and the icon and the colour beside it are the redundant
 * halves rather than the message.
 *
 * Only Offers can reach it today, because NFR7 states the one band this product
 * has and states it per Offer.
 */
export const PAST_BAND_MARKER = "Fuera de plazo";

/**
 * What the shell still cannot see.
 *
 * **Deliberate and temporary.** While four of the five sections have no resolver,
 * a shell that reported the four it has would be an instrument that lies — an
 * Admin would read the queue as shallow because most of it is not being counted.
 * So the coverage is stated where it is read, and the ticket that lands the fifth
 * section deletes this line rather than updating it.
 *
 * `Intl.ListFormat` rather than a hand-rolled join: Spanish takes _e_ rather than
 * _y_ before a word starting with the *i* sound, and a joiner that did not know
 * that would be wrong the first time a section is named _Imágenes_.
 */
const spanishList = (items: readonly string[]) =>
  new Intl.ListFormat("es-CO", { style: "long", type: "conjunction" }).format(items);

export const coverageNotice = (live: readonly string[], pending: readonly string[]) =>
  `Por ahora la fila solo cuenta ${spanishList(live)}. ` +
  `Todavía faltan ${spanishList(pending)}: lo que haya ahí no aparece en estos números.`;

/**
 * The platform signal: profiles published faster than people plausibly arrive.
 *
 * **It is not a queue item and carries nothing to press**, which is the whole of
 * what it is — publishing is never refused, and the queue simply says the rate is
 * unusual. The last sentence says so out loud, because an operator who found a
 * warning with no action would go looking for the action.
 *
 * It says a number rather than "mucho": the Admin decides what to do with it, and
 * eleven and ninety are different days.
 */
export const PUBLISH_SIGNAL_TITLE = "Se están publicando perfiles más rápido de lo habitual.";
export const publishSignalBody = (count: number) => `${count} perfiles en la última hora.`;
export const PUBLISH_SIGNAL_NOTE =
  "No hay nada que hacer aquí, y no frenamos ninguna publicación. Es solo para que lo sepas.";

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

/**
 * The panel that ends an Account's sessions (NFR13), and the nav row that reaches
 * it.
 *
 * **Its own group, below the five sections, because it is a tool and not a
 * backlog.** Nothing accumulates here, so it has no count, no oldest item and no
 * band — and a row in the queue's own list would be a control sitting inside an
 * instrument. The nav label is the verb; the heading on the page is the full
 * sentence, because a nav row is scanned and a heading is read.
 */
export const TOOLS_NAV_LABEL = "Herramientas";
export const SESSIONS_NAV_LABEL = "Cerrar sesiones";
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
// `listado` is on `NEVER_SAY` — with `directorio` and `servicio`, because this
// product introduces two people and steps out of the way rather than being a
// place things are listed. Found by wiring this surface into the voice checks
// for the first time; the word had been here since the section was written.
export const PROMOTE_HEADING = "Agregar una capacidad al vocabulario";
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
/** Says what to do rather than what the code is (voice guide, Do 3). */
export const PROMOTE_CUOC_SHAPE = "Escribe los cinco dígitos del código, o déjalo vacío.";

/**
 * What the Admin is told afterwards: the entry, quoted back.
 *
 * **The label rather than a count**, because one promotion is one entry and the
 * thing worth confirming is *which words* are now in front of every Worker on the
 * publishing form — the Admin typed them a moment ago and this is the only place
 * they are read back.
 */
export const skillPromoted = (labelEs: string) => `Agregamos «${labelEs}» al listado.`;

/**
 * When the request arrived, so an Admin can see what is oldest without
 * arithmetic.
 *
 * **The year is written out**, which is `docs/policy/voice.md`'s own date format:
 * `10 de agosto de 2026`, never `08/10/2026` — *"which reads as August in one
 * country and October in another"*. It costs three words on a queue that will
 * hold rows from more than one year.
 */
export const requestedOn = (at: Date) =>
  `Pedida el ${at.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`;

/**
 * The Offers section — the one branch with a deadline on it, which is why
 * `/admin` redirects here and why it leads the nav.
 *
 * Admin register throughout (Warmth 5→2, Sophistication 2→4): one operator
 * working a queue, density over warmth, and the age of the oldest item is a
 * number rather than a sentence.
 */

/**
 * The line above the terms: who wrote it, and who it is for.
 *
 * **His name is badged as declared rather than verified**, here as everywhere
 * else it appears — nobody checked it, and the queue is the surface where that
 * matters most, because this is where a person decides whether it reaches her.
 * An Account that has never named itself carries no name at all, and the
 * sentence says so rather than rendering an empty space.
 */
export const offerSummary = (
  workerFirstName: string,
  workerLastInitial: string,
  hirerName: string | null,
) =>
  `${hirerName ? `De ${hirerName} (nombre sin comprobar)` : "De alguien que no puso nombre"} ` +
  `para ${workerFirstName} ${workerLastInitial}.`;

/** The three things an Offer names, as the queue labels them. */
export const OFFER_WORK_FIELD = "El trabajo";
export const OFFER_PAY_FIELD = "El pago";
export const OFFER_WHEN_FIELD = "Cuándo";

/** When it was sent — the same long-form date `requestedOn` uses, for its reason. */
export const offerSentOnQueue = (at: Date) =>
  `Enviada el ${at.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`;

/**
 * The section's two actions, and what each does said in the verb.
 *
 * *Entregar* rather than *Aprobar*: an Admin is not approving a person or her
 * work, they are letting a message through to somebody. Its pair is
 * *No entregar* rather than *Rechazar* for the same reason from the other side —
 * what is being refused is the delivery, not the person who wrote it, and the
 * voice guide's boundary rule is that the care is directed at the process. The
 * two verbs are deliberately the same verb, one negated: an Admin reading twenty
 * rows is choosing between two outcomes of one decision, not between two
 * unrelated acts.
 *
 * **Both are on every row, in this order, always.** The affordances do not move
 * and do not appear conditionally — a control whose position depends on the row
 * is a control that gets pressed by mistake on the twentieth one.
 */
export const DELIVER_OFFER_SUBMIT = "Entregar";
export const DELIVER_OFFER_SUBMITTING = "Entregando…";
export const REJECT_OFFER_SUBMIT = "No entregar";
export const REJECT_OFFER_SUBMITTING = "Deteniendo…";

/** What the Admin is told afterwards: which row moved, and where it went. */
export const offerDelivered = (workerFirstName: string) => `Se la entregamos a ${workerFirstName}.`;
/**
 * The other outcome, and it states the consequence rather than the state.
 *
 * *"No le llegó a nadie"* is what an Admin needs to be able to say later. The
 * Hirer's own list says the same thing today, in the same words, and that is a
 * coincidence rather than a contract — **it is deliberately not the same
 * constant**: these are two audiences, and sharing the string would mean a
 * rewording for the person whose Offer was stopped silently rewording the
 * operator's confirmation.
 *
 * The name of nobody appears in it: an Offer stopped here reached no Worker, so
 * naming one would describe something that did not happen.
 */
export const OFFER_REJECTED = "No la dejamos pasar. No le llegó a nadie.";

/**
 * What a row says about itself once the decision is made and the queue has not
 * been reloaded.
 *
 * **The row stays, and it stops being actionable.** Removing it on the spot would
 * take the outcome off the screen and shift every row below it under a cursor
 * that is mid-queue; leaving the buttons live would invite a second press against
 * a state the server has already moved. So it holds its place and says what
 * happened, and the next reload is what clears it.
 */
export const OFFER_ROW_RESOLVED = "Ya decidida.";

/* --------------------------------------------------------------------------
 * The photo section.
 *
 * **Nothing here names the person whose photo it is**, and that is the shape of
 * the decision rather than a precaution: an Admin is deciding whether one image
 * may be public, and her name, her city and her headline are facts the decision
 * does not need. The brief at `.impeccable/briefs/photo.md` says so under
 * _Interaction and layout_.
 * ----------------------------------------------------------------------- */

/** The heading over one waiting photo, and the group the two decisions sit in. */
export const PHOTO_REVIEW_HEADING = "Decidir sobre esta foto";

/**
 * The `alt` for the photo under review.
 *
 * **It describes the role of the image rather than its contents**, because
 * nobody here knows its contents — that is the whole reason a person is looking.
 * Never a description of her or of her circumstances.
 */
export const PHOTO_REVIEW_ALT = "Foto que está esperando revisión";

/** What the two decisions do, as the verb of the action. */
export const PHOTO_APPROVE = "Publicar la foto";
export const PHOTO_APPROVING = "Publicando…";
export const PHOTO_REJECT = "No publicarla";
export const PHOTO_REJECTING = "Quitando…";

/**
 * What rejecting costs, said before it is pressed.
 *
 * **It is irreversible and the copy says so plainly** — the voice guide's
 * _"no se puede deshacer"_, which is on its Say list for exactly this kind of
 * act. Rejecting deletes the object; there is no undo and no second look.
 */
export const PHOTO_REJECT_WARNING = "Al no publicarla, borramos la foto. No se puede deshacer.";

/**
 * The decision did not go through and it was not the Admin's doing.
 *
 * These actions take no typed payload, so a refused boundary parse is a defect
 * on our side rather than a mistake on theirs — the sentence says the state of
 * the queue and what to do, and blames nobody.
 */
export const PHOTO_DECISION_FAILED = "No pudimos guardar esa decisión. Vuelve a cargar la página.";

/** Afterwards, in the row's own announced region. */
export const PHOTO_APPROVED = "Publicamos la foto. Ya se ve en su perfil.";
export const PHOTO_REJECTED = "Borramos la foto. Puede subir otra.";

/** How long this one has been waiting, in the same words and format `requestedOn` uses. */
export const photoWaitingSince = (at: Date) =>
  `Esperando desde el ${at.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`;
