# Voice

Owner: **Design lead** ([owners.md](owners.md)). Read by `ux-writing`, `copywriting`, `impeccable`,
and by every ticket that renders an `es-CO` string.

**This file is the _value_ of a policy key, not a table of keys**, which is why it carries prose where
its siblings carry a grid and why it has no `UNSET` header line. `ux.md` → `voice-guide` is the key;
everything below is what that key resolves to. `grep -rn UNSET docs/policy/` will therefore never name
this file, and should not.

It was held `UNSET` **by decision** through
Plan and Design — [intent Q6](../efforts/0002-profile-to-contact-exchange/intent.md) — and set here by
a `brand-voice` session, because inventing a voice for a product where the difference between
_trabajadora_ and _damnificada_ **is** the product would have been worse than naming the gap.

**The prose here is English and every example is `es-CO`.** That is NFR29 working as intended, not an
inconsistency to fix: this document is read by developers and agents, and the strings it governs are
read by a person in Risaralda. A rule stated in English and demonstrated in English could not be
checked against the string it governs.

## The failure mode this guide exists to prevent

Not blandness. **Othering.**

A brand-voice exercise usually protects against sounding like everyone else. The risk here runs the
other way, and intent Q6 says so outright: the danger is copy that is warm, well-meant, fluent, and
describes the person reading it as someone that things happened to.
[ADR-0009](../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) already removed the loss
narrative from the data model. This guide is what stops it coming back in as a sentence.

Every rule below is testable against a single sentence of copy. A rule you cannot fail is not a rule.

## Archetype

**Caregiver** — chosen deliberately, and **bounded by the next section**, which is the part that makes
it survive ADR-0009.

The conventional objection to Caregiver here is real: it is the archetype that turns the platform into
the helper and the person reading into the helped. It was chosen anyway because this platform actually
does caregiving work, and a great deal of it — a human reads **every** Offer before it is delivered,
every photo is moderated, her contact details are held until she accepts, free-text fields refuse
phone numbers so the consent step cannot be routed around, and — in
[ADR-0008](../adr/0008-open-enrolment-with-published-non-verification.md)'s own words — "standing safety
guidance sits on every profile and every Offer". Refusing the archetype would have meant a voice that under-describes what the
product genuinely does for her.

**Voice in one sentence:** a calm, warm neighbour who has already done the protective thing, tells you
plainly what it does and does not cover, and never once mentions what you lost.

### The boundary rule

> **The care is directed at the process. Never at the person.**

This is the load-bearing rule in this document. It is what lets a Caregiver archetype coexist with
ADR-0009, and everything in the Rules section is downstream of it.

The test is mechanical. Take the sentence. Could it be rewritten as _"…porque lo estás pasando mal"_
and still mean roughly the same thing? Then the care is aimed at the person and the sentence is broken.

| Aimed at the process — write this                                             | Aimed at the person — never                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| _Una persona lee cada propuesta antes de que te llegue._                      | _Queremos que te sientas segura._                      |
| _Tu teléfono no sale de aquí hasta que tú aceptes._                           | _Sabemos que estos meses han sido difíciles._          |
| _Guardamos lo que escribiste._                                                | _Estamos contigo en este proceso._                     |
| _Si algo de esto te incomoda, puedes bloquear a esa persona sin dar razones._ | _Te acompañamos para que no tengas que pasar por eso._ |

The right column is not clumsy writing. It is fluent, kind, and exactly the register this product has
to refuse.

## The word that names the person using this product

**The position: most of the time, the product does not name her at all.**

That is not evasion, and it is not only a solution to grammatical gender — it is
[ADR-0009](../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) applied to grammar. The
page is about what she can do, so the copy reaches for the **verb or the capability** before it reaches
for a noun that classifies her. _Publica lo que sabes hacer_ says everything _Eres trabajador/a_ says,
plus the thing that matters, and it classifies nobody.

Where a noun is genuinely unavoidable — a role selector at sign-up, a heading over a list — it is
**trabajador/a** and **contratante**, the renderings [`CONTEXT.md`](../../CONTEXT.md) fixes. The slash
form is tolerated there and nowhere else.

**Be precise about why, because the imprecise version is a rule nobody can apply.** A slash form is not
a WCAG 2.2 AA failure, and this guide does not claim it is — `docs/policy/ux.md` → `wcag-level` is met
either way. It is a **listening cost**: a screen reader announces the slash on every occurrence, so
_El/la trabajador/a aceptó tu propuesta_ is heard with three interruptions in one sentence. Rephrasing
is what keeps that cost at roughly one occurrence in the product instead of one per label, and the
sentence-level rules that _are_ AA obligations are collected under **Accessibility rules that are voice
rules** below.

**The nouns that are never used are not a style preference.** `CONTEXT.md`'s _Avoid_ lists are binding
vocabulary, and this guide adds the reason: every one of _damnificado_, _víctima_, _afectado_,
_beneficiario_ names a person by an event rather than by a capability. So does _necesitado_. So, more
quietly, does _historia_ when it is her story being asked for.

**One distinction the ban does not cover, and it matters.** The earthquake may be named as a fact about
**why the platform exists** — that is story 11's About page, and refusing to say it would be its own
kind of dishonesty. It may never be named as a fact about **a person**: not on a profile, not on a card,
not in a form's help text, not in an email, not in an `alt` attribute.

- ✓ _Recomencemos existe porque el terremoto del 10 de agosto dejó a mucha gente de Risaralda sin
  trabajo._
- ✗ _Personas afectadas por el terremoto que ofrecen su trabajo._
- ✗ `alt="Trabajadora damnificada de Dosquebradas"`

## Register, person, and grammatical gender

**`tú`, throughout, on every surface and to both sides.** Second person singular, informal. Verb forms
follow: _publicaste_, _puedes_, _quítalo_, _lee_.

**`nosotros` for the platform, and only where the platform actually acts.** _Leemos cada propuesta_ is
true and is ours to say. _Te acompañamos_ is not an action, and the boundary rule already refuses it.

**Grammatical gender is handled by rephrasing, not by slashes.** Prefer the verb, the capability, or the
plural-neutral phrase. Never the `-e` form.

| Instead of            | Write                                        |
| --------------------- | -------------------------------------------- |
| _¿Eres trabajador/a?_ | _Publica lo que sabes hacer_                 |
| _Bienvenido/a_        | _Qué bueno tenerte aquí_ · _Ya estás dentro_ |
| _Trabajadores/as_     | _Personas que ofrecen su trabajo_            |
| _El/la contratante_   | _Quien envía la propuesta_                   |
| _Estás registrado/a_  | _Tu cuenta ya está lista_                    |

This rule pays for itself hardest in the Skill vocabulary — see **What ticket #15 has to satisfy** at
the bottom — where verb-phrase labels are genderless by construction.

**What was accepted knowingly.** In the Eje Cafetero, `usted` is the ordinary everyday form, used with
strangers, neighbours and family alike; `tú` is the register of software written elsewhere. Choosing
`tú` buys warmth and one consistent form across a Worker in Dosquebradas and a Hirer in Madrid, and it
costs a small amount of local truth. **The revisit trigger is evidence, not opinion:** if usability
work or the seven-day check-in surfaces people reading the site as foreign or as not addressed to them,
this is the first thing to change, and it is a single decision rather than a rewrite — the rules below
are register-independent.

## Dimensions

Three are pushed to an extreme, in bold. The rest are moderate on purpose: an all-extreme setting is a
caricature and an all-moderate one is nobody.

| Dimension      | Setting (1–5)   | Why                                                                                                                                                                                         |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formality      | 4 — casual      | `tú`, ordinary words, no _le informamos que_. A person on a phone, not a notification from an institution                                                                                   |
| Optimism       | 3 — level       | [ADR-0007](../adr/0007-the-platform-never-handles-money.md): we hold no money and can promise no outcome. Optimism that outruns what we hold is the one dishonesty this voice cannot afford |
| Humor          | **1 — serious** | Nothing a person meets here is funny to them. A joke in a refusal, an empty state, or a Contact Exchange reads as not having understood the room                                            |
| Confidence     | 4 — confident   | We state what we do and do not do without hedging. Not 5, because _no lo sabemos_ has to stay sayable where it is true                                                                      |
| Sophistication | 2 — simple      | Short sentences and ordinary words. The only permitted exceptions are the terms Ley 1581 requires by name — _responsable del tratamiento_, _autorización_, _consulta_, _reclamo_            |
| Warmth         | **5 — warm**    | The archetype. Bounded by the boundary rule above, which is what keeps warmth from becoming pity                                                                                            |
| Energy         | 2 — calm        | She may be reading on a slow connection, on a borrowed phone, deciding something that matters. Energy reads as pressure                                                                     |
| Directness     | **5 — direct**  | Every absence — no verification, no money, no recourse if she is not paid, what a Block does not reach — is stated first and plainly. **This is the dimension that keeps Caregiver honest** |

**Swap test.** Substitute the nearest neighbours and the guide should stop fitting. A relief or
donation platform fails it at Directness 5 and at the ban on _ayuda_, _donación_ and _causa_ — its
whole voice is aimed at the person's circumstances. A job board fails it at Warmth 5 and at the ban on
_candidato_, _hoja de vida_ and _vacante_. The guide is specific to this product.

## Rules

### Do

1. **Name what we actually do, in the present tense, with the actor visible.** _Una persona lee cada
   propuesta antes de que te llegue._ Not _las propuestas son revisadas_.
2. **Put the absence first when there is one.** _Aquí no verificamos a nadie_ opens the notice; what we
   do instead follows it and never replaces it.
3. **Say what she can do next in the same breath as what failed.** An error with no next step fails this
   rule and NFR20 together.
4. **Quote the product's own evidence back.** The rejected fragment, the count, the time it resets, the
   name of the person who will receive her number. A refusal she can check is a refusal she can trust.
5. **Describe her by what she can do.** Every noun, verb and heading on a profile, a card or a form is
   about capability.

### Don't

1. **Don't make the platform the subject of a sentence about her feelings.** _Queremos que te sientas
   segura_ ✗ → _Tu teléfono no sale de aquí hasta que tú aceptes_ ✓.
2. **Don't use a word from a `CONTEXT.md` _Avoid_ list _where you mean that list's term_.** Anywhere —
   body copy, a button, an email subject, an `alt` attribute, a `<title>`. **The scoping is not a
   loophole and the rule is wrong without it:** those lists are per-term, and Account's reads _"Avoid:
   User, member, profile, registration"_ — which bans _perfil_ as a word for **an Account**, not the
   word _perfil_, prescribed two lines below for a CapabilityProfile. Read the ban against the concept
   you are naming.
3. **Don't attach the earthquake to a person.** A fact about the platform, yes. A property of someone,
   never.
4. **Don't soften a refusal into ambiguity.** _En este momento no es posible_ ✗ → what happened, and
   when it changes.
5. **Don't use the passive to hide who acted, especially when the actor is us.** _Fue revisado_ ✗ →
   _Lo leímos_ ✓.

### Say · Never say

**Say:** trabajo · pago · propuesta · perfil · capacidad · lo que sabes hacer · una persona lee ·
tu teléfono · decides tú · quien envía la propuesta · antes de que te llegue · no se puede deshacer

**Never say:** damnificado/a · víctima · afectado/a · beneficiario/a · necesitado/a · ayuda · ayudar
(where the object is a person's situation) · donación · donar · apoyar (in the charity sense) · causa ·
tu historia · candidato/a · aspirante · hoja de vida · CV · vacante · empleo · oferta laboral ·
empleador · usuario/a · match · verificado (in any construction implying that we verify) · seguro/a (as
a promise, since we cannot make one) · directorio · tablero · listado · categoría · servicio · etiqueta ·
queja · denuncia · reporte de abuso · vacante · trabajito · moderador · administrador (of a person —
_Admin_ is a role, and the site does not need to name it to her) · silenciar · ocultar

**And one that is a sentence rather than a word.** `CONTEXT.md`'s Block entry bans not just _ban_,
_mute_ and _hide_ but the **description**: _"avoid describing it as making her invisible, which it never
was."_ A Block stops him sending and reaches nothing else — her card stays public, his reading stays
open. Copy that says _ya no te verá_ is false, and it is the kind of false that a person relies on.

_Ayudar_ has one narrow survival: a concrete task with a concrete object — _Te ayudamos a llenar el
formulario_ — is fine. _Ayuda a una familia de Pereira_ is the register this product exists to refuse.

### Sentences

- **Body copy: 20 words or fewer per sentence, not counting the items of a list. Labels and buttons: 5
  or fewer.** Both are countable, which is the point — the exemption is there because an enumeration of
  what deletion reaches is long for a reason, and shortening it would cost information rather than words.
- Active voice, actor named.
- **No exclamation marks**, with one exception: a success state may carry at most one. Never a refusal,
  never a notice, never an email subject.
- **No ALL CAPS for emphasis** — some screen readers spell them out, and it reads as shouting.
- **Link text names its destination.** Never _haz clic aquí_, never _aquí_, never _más información_.
- **Buttons say the verb of their action**, not _Enviar_ or _Continuar_, and especially not where the
  action is irreversible: _Aceptar y dar mis datos_.
- **`es-CO` number, money, date and time formats.** `$50.000` (period for thousands, comma for
  decimals) · `3:40 p. m.` (12-hour, with the periods and the space) · `10 de agosto de 2026` — never
  `08/10/2026`, which reads as August in one country and October in another.
- **No sentence that only someone who already knows the product can parse.** _Tu perfil está en
  revisión_ ✗ — nothing about her profile is in review; her photo is.

### Accessibility rules that are voice rules (NFR20)

These are here rather than in a separate document because each one is a sentence-level writing rule,
and a writer who never opens the accessibility spec will still open this file.

- An error names **what happened** and **what to do**. Never bare _Error_, never a red border alone.
- Never refer to meaning carried by colour or position — _el campo en rojo_ ✗, _el botón de la derecha_
  ✗. Name the field.
- Every meaningful image has an `alt` that says what it shows, in Spanish, subject to every ban above.
- Emails set `lang="es"`, ship a plain-text alternative, use descriptive link text, and keep one `h1`
  (DD14).

## Tone matrix

Voice is constant; tone flexes. **The archetype never changes** — only the dimension settings do.

| Context                       | Dimension shifts                             | Note                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Publish form**              | Energy 2→3, everything else unchanged        | She is doing work, not being processed. Field help is one line saying what the field is _for_, never what it must contain. The photo's pending state is described, never badged (intent Q3) |
| **Writing an Offer** (Hirer)  | Warmth 5→3, Confidence 4→5                   | The Hirer is not the person this voice protects. The human review and the immutability are stated **before** he writes, not after he submits                                                |
| **Reading an Offer** (Worker) | unchanged                                    | Everything in front of her, nothing nudging. No _¡Nueva propuesta!_, no countdown, no default-highlighted Accept                                                                            |
| **A refusal**                 | Optimism 3→4, Energy 2→1, Warmth 5 unchanged | Rate limit, rejected contact detail, failed validation. **The one place warmth is load-bearing**: the refusal is our rule, never her mistake                                                |
| **Contact Exchange**          | Energy 2→3, Directness 5 unchanged           | Names exactly which fields cross, that it cannot be undone, and that the email is a **copy** of what is already on screen                                                                   |
| **The two standing notices**  | Warmth 5→3, Directness 5 unchanged           | Non-verification (ADR-0008) and no-money (ADR-0007). Read by both sides and by a journalist. The absence leads; warmth here reads as softening                                              |
| **Email**                     | Energy 2→1                                   | It arrives uninvited, on a phone, possibly on mobile data. The subject line says what happened — no marketing verbs, no urgency                                                             |
| **Admin surfaces**            | Warmth 5→2, Sophistication 2→4               | One operator working a queue. Density over warmth. The age of the oldest item is a number, not a sentence                                                                                   |

## Before / After

Pre-launch, so the "before" in each pair is the sentence this product would plausibly ship without this
file — the fluent, well-meant default. Each pair names the rule that moved it.

**1. The non-verification notice** — Wall and every profile (story 11, ADR-0008)

> **Before:** _Queremos que te sientas segura en Recomencemos. Por eso te contamos que no verificamos
> a las personas, y te damos recomendaciones para cuidarte en cada paso._
>
> **After:** _Aquí no verificamos a nadie. No comprobamos que quien publica haya perdido su trabajo.
> Tampoco que quien envía una propuesta sea quien dice ser. Lo que sí hacemos: una persona lee cada
> propuesta antes de que te llegue. Y tu teléfono no sale de aquí hasta que tú aceptes._

— Boundary rule (the before opens on how _we_ feel, and _cuidarte_ casts her as needing care); Do 2
(the absence leads); Do 1 (present tense, actor visible).

**2. Hitting the publish ceiling** — `publishProfile` ≤ 3/day

> **Before:** _Has alcanzado el límite de publicaciones. Intenta más tarde._
>
> **After:** _Publicaste tres veces hoy, que es el máximo. Puedes intentarlo otra vez mañana. Nada de
> lo que escribiste se perdió: sigue aquí._

— Do 4 (the count is quoted back); Do 3 (what to do next, in the same breath); Don't 4 (_más tarde_ is
ambiguity). The spec names this exact case: a Worker who trips this after two failed attempts currently
meets silence, from a requirement that passes green.

**3. The contact-detail rejector** — NFR12, on the one line in her own words

> **Before:** _Texto inválido: no se permiten números de teléfono._
>
> **After:** _Esta línea tiene un número de teléfono: «321 456 7890». Quítalo e inténtalo de nuevo. Tu
> teléfono se lo damos nosotros a quien tú aceptes, para que nadie pueda pedírtelo antes._

— Do 4 (names the fragment, per NFR12); Boundary rule (the care is aimed at the consent step, not at
her judgment); Don't 4 (_inválido_ makes it her error rather than our rule).

**4. The Contact Exchange confirmation** — story 9, the two-step confirm

> **Before:** _¿Estás seguro? Esta acción no se puede deshacer._
>
> **After:** _Si aceptas, Carlos Restrepo recibe tu nombre completo, tu teléfono y tu correo. Tú recibes
> los suyos. Esto no se puede deshacer: una vez que los tiene, ya los tiene._

— Do 4 (names the person and the exact fields); Directness 5 (the last clause is ADR-0009's asymmetry
said plainly instead of as _no se puede deshacer_, which sounds like a UI constraint).

**5. Deleting an Account** — story 13, C23

> **Before:** _¿Eliminar tu cuenta? Se borrarán todos tus datos de forma permanente._
>
> **After:** _Borramos tu perfil, tus capacidades, tu foto y tus datos de contacto: de la plataforma,
> hoy; de las copias de seguridad, en siete días. Lo que no podemos borrar: si ya aceptaste una
> propuesta, quien te la envió tiene tu teléfono desde ese día. Borrar tu cuenta no lo alcanza._

— Don't 5 (_se borrarán_ hides that we are the ones deleting); Do 1; Directness 5. _Todos tus datos_ was
a promise of a reach deletion does not have, which is the failure ADR-0007 names in another register:
an implied guarantee is worse than none, because it is relied upon.

**6. Sending an Offer** — story 6, the Hirer's side

> **Before:** _Tu propuesta será revisada antes de ser enviada._
>
> **After:** _Antes de que le llegue, una persona lee tu propuesta. Suele tardar menos de un día.
> Después no vas a poder cambiarla, así que revisa bien lo que ofreces: el trabajo, el pago y cuándo._

— Don't 5 (two passives hiding the same actor); tone matrix (Warmth 5→3 for the Hirer); Do 1. The
24-hour figure is intent Q3's; it is best effort against `on-call-rotation` = nobody, and copy that
promises it as a guarantee is out of bounds.

## What ticket #15 has to satisfy

The Skill vocabulary is seeded from **CUOC** (DD12) and translated. DD12 calls that translation craft
that _"has no authority until `voice-guide` is set"_ — this is the authority, stated as a test rather
than as advice. The seeding itself is [#15](https://github.com/m0t0r/recomencemos/issues/15), not this
ticket.

**The test:** read the label aloud after _"Sé…"_ or _"Puedo…"_. If it does not finish the sentence the
way a person would actually say it, it is still CUOC.

The four rows below **demonstrate the test; they are not the seed.** #15 owns the vocabulary, and a
label that ships is the one in its migration — not the one quoted here. Copying these four into the
seed would give the list two sources of truth, which is the failure this note exists to prevent.

| CUOC's register                         | The label she reads                |
| --------------------------------------- | ---------------------------------- |
| _Cocineros_                             | _Cocinar para eventos y almuerzos_ |
| _Personal doméstico de limpieza_        | _Limpieza de casas y apartamentos_ |
| _Fontaneros e instaladores de tuberías_ | _Plomería y arreglo de tuberías_   |
| _Cuidadores de niños_                   | _Cuidado de niños_                 |

Three rules follow from this document:

- **Verb phrase or capability noun, never an occupational noun.** This is the gender rule paying for
  itself: _Cocinar para eventos_ needs no slash, while _Cocinero/a_ does.
- **Granularity is what a Hirer would type into search**, not CUOC's fifth digit.
- **`Skill.labelEs` holds the Spanish; the column name does not.** NFR29 — the identifier stays English,
  and `Skill.cuocCode` records the provenance of each entry.

## What this guide does not touch

**Identifiers.** Every Spanish string in this file is a **value**. No rule here names a route segment, a
file, a table, a column, an enum member, a query parameter, an API field, a log `event`, a test or a
branch — those are English, without exception
([ADR-0012](../adr/0012-spanish-is-the-interface-english-is-the-code.md), NFR29). The shape to copy is
`Skill.labelEs`: an English column holding _Cocinar para eventos y almuerzos_.

**The visual system.** [`DESIGN.md`](../../DESIGN.md) is the visual authority and `globals.css` holds
the values it names. This file governs words.

**What each string must say.** The spec's **UX design** section already fixes that, surface by surface
and state by state, for all twelve surfaces plus the seventh `rate limited` state. This file governs
**how** it is said. Where the two meet — a `permission denied` cell, an empty state — the spec decides
the content and this file decides the sentence.
