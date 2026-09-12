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
 * The queue with nothing waiting.
 *
 * **It is a good state and the copy has to say so**, which is the acceptance
 * criterion in as many words. A queue at zero means everything in it has been
 * read and nobody is waiting behind the band — the best this screen can report.
 * The default empty state ("no hay nada") reads as an absence of data, which on
 * this surface would be indistinguishable from a source that failed to load.
 *
 * **The body states the age as zero**, which the criterion asks for outright:
 * _"a real and good state, saying the oldest-item age is zero"_ — the same figure
 * the shell's headline shows, said again where the list would be.
 */
export const QUEUE_EMPTY_TITLE = "No hay nada esperando.";
export const QUEUE_EMPTY_BODY = "Todo está revisado: lo más antiguo en la fila es 0 h.";

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
 * How much is waiting, beside the oldest-item figure.
 *
 * **Counted over every whole branch that answered, never over the rows that
 * render** (C55) — so it can say 400 while twenty are on screen, which is the
 * point of saying it. A phrase rather than a bare number, because "Fila, 12"
 * read aloud is a list position as easily as a backlog.
 */
export const waitingInQueue = (total: number) => `${total} por revisar`;

/**
 * The one list (#277), and what it is called in the accessibility tree.
 *
 * **The name says the order**, because the order is the design: one list across
 * every source, oldest first, so nothing old waits behind a section nobody
 * opened. A screen-reader user entering the group hears that before the first
 * row, which is the same fact a sighted Admin gets from the ages down the right.
 */
export const QUEUE_LIST_LABEL = "Lo que espera, lo más antiguo primero";

/** The three columns. Short, because they are scanned rather than read. */
export const SOURCE_COLUMN = "Tipo";
export const SUMMARY_COLUMN = "Qué espera";
export const AGE_COLUMN = "Esperando";

/**
 * The keys, said where they work.
 *
 * **Said at all because a shortcut nobody is told about is not an accelerator.**
 * The letters render as keycaps between these fragments; the scope sentence is
 * WCAG 2.2 SC 2.1.4 made visible — the keys act only with focus in the list, so
 * typing in a field never moves or decides anything.
 *
 * **Skill requests have no key**, and the last sentence says so rather than
 * leaving an Admin to press _a_ on one and wonder: promoting means typing an
 * identifier and a name, which no single key can stand in for.
 */
export const KEYS_MOVE = "para moverte";
export const KEYS_DECIDE = "para decidir.";
export const KEYS_SCOPE = "Funcionan con el foco en la lista, nunca mientras escribes.";
export const KEYS_NOT_FOR_SKILLS = "Las capacidades pedidas se deciden con su formulario.";

/**
 * The source filter.
 *
 * **It opens on everything**, and narrowing is a choice the Admin makes and can
 * see in the control; the headline beside it always measures the whole queue.
 */
export const FILTER_LABEL = "Mostrar";
export const FILTER_ALL = "Todo";
export const filterOption = (label: string, total: number) => `${label} (${total})`;

/**
 * When the display caps hide rows (C55): how many are on screen out of how many
 * wait, and how the rest arrive.
 */
export const shownOfWaiting = (shown: number, total: number) =>
  `Se ven ${shown} de ${total}. El resto aparece a medida que decides y vuelves a cargar.`;

/**
 * A row decided on this screen, in its summary line.
 *
 * **The row keeps its place and says so**, for the reason `OFFER_ROW_RESOLVED`
 * gives: removing it would shift every row below under a cursor that is
 * mid-queue. The next reload is what clears it.
 */
export const ROW_DECIDED = "Decidida";

/**
 * A row whose item has passed its source's band.
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
 * The panel that ends an Account's sessions (NFR13), and the link in the shell's
 * header that reaches it.
 *
 * **A tool and not a backlog, so it is not a row in the list.** Nothing
 * accumulates here, so it has no count, no oldest item and no band — and a row in
 * the queue would be a control sitting inside an instrument. The link names the
 * page it opens, so it is the heading's own words.
 */
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
/**
 * The group is how a Hirer reaches the entry before he knows its exact name, so
 * the help says that rather than naming the concept.
 */
export const PROMOTE_GROUP_LABEL = "Grupo";
export const PROMOTE_GROUP_HELP = "Dónde la encuentra quien busca por tipo de trabajo.";
/** The empty first option: a choice nobody made, never a default group. */
export const PROMOTE_GROUP_CHOOSE = "Elige un grupo";
export const PROMOTE_CUOC_LABEL = "Código CUOC (opcional)";
export const PROMOTE_CUOC_HELP = "Si la capacidad corresponde a una ocupación de la CUOC.";
export const PROMOTE_SUBMIT = "Agregar";
export const PROMOTE_SUBMITTING = "Agregando…";

/** The identifier's own rules, as refusals rather than as instructions. */
export const PROMOTE_SLUG_REQUIRED = "Escribe el identificador en inglés.";
export const PROMOTE_SLUG_SHAPE = "Solo minúsculas, números y guiones.";
export const PROMOTE_LABEL_REQUIRED = "Escribe el nombre que se va a leer.";
export const PROMOTE_LABEL_TOO_LONG = "Acórtalo: hasta 80 caracteres.";
export const PROMOTE_GROUP_REQUIRED = "Elige el grupo donde va esta capacidad.";
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
 * **Her Pause, where an Admin sees her** (story 25). The queue is not changed by
 * a pause — an Offer sent before it is still read and delivered — but the Admin
 * delivering it should know she is not on the site right now, so the row carries
 * one more field, present only while she is paused.
 *
 * _En pausa_ is `CONTEXT.md`'s word for her state and the one her own page
 * uses. Never _oculto_ and never _retirado_, which reads as a takedown — the one
 * thing an Admin must not mistake her own choice for.
 */
export const OFFER_WORKER_PROFILE_FIELD = "Su perfil";
export const workerPausedSince = (at: Date) =>
  `En pausa desde el ${at.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`;

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
