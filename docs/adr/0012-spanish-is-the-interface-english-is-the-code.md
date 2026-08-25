---
status: proposed
---

# Spanish is the interface; English is the code

`es-CO` is the product's only language and is not a translation of an English original. It is also
**only** the language of what a person reads. Every identifier a developer types is English: route
segments, file and directory names, database tables and columns, enum values, query parameters, API
request and response field names, log `event` names, test names, branch names, commit messages.

The line falls between an **identifier** and a **value**. `Skill.labelEs` is the shape of the rule in
one column: an English name holding a Spanish string. The same holds for a `city` enum whose values are
Colombian place names, and for every UI string in the app.

## Why

The first draft of effort 0002's spec routed the whole product in Spanish — `/perfiles`,
`/publicar`, `/propuesta/[id]`, `app/mi-perfil/page.tsx` — and carried it through the API contract,
the UX target paths and the deep dives before anyone noticed. That is the failure this record exists
to prevent, and it is worth being precise about why it is a failure rather than a preference.

**A codebase with two naming languages has no shared vocabulary.** `CONTEXT.md` fixes eleven domain
terms in English — Worker, CapabilityProfile, Offer, Contact Exchange, Block — and gives each its
Spanish UI rendering. The moment a route is `/propuesta` while the entity is `Offer` and the table is
`offer`, a reader has to hold a translation table to follow one request through the stack, and every
grep needs two spellings. The glossary stops being the single source of the vocabulary.

**It compounds silently.** Nobody renames a route after launch — it is a URL, an analytics key, a
bookmark, and a row in someone's runbook. The cost is paid once at Design and forever afterwards.

**Contributors and tooling assume English identifiers.** Framework conventions, library APIs, error
messages, stack traces and every agent skill in this repository are English. A mixed-language
identifier space makes each of those a small translation step.

## Considered options

**Spanish identifiers throughout, matching the UI.** The apparent virtue is that one word means one
thing from the URL bar to the column name. Rejected because it only holds for the terms that have a
clean Spanish equivalent: `photoState`, `rotationKey`, `deliveredAt` and `searchText` have no natural
Spanish form anyone would agree on, so in practice the codebase lands in _both_ languages with no rule
saying which goes where — the worst of the three options.

**Spanish routes with English code**, i.e. localized URLs over an English schema. This is a real and
defensible pattern, and it is what the draft accidentally implemented. Rejected because the boundary
is invisible: nothing in a file tree or a review tells you which layer you are in, so the split erodes
at exactly the seam it is meant to hold — a Server Action named for its Spanish route, a test named
for the page it exercises.

**English identifiers, Spanish interface (chosen).** One rule, stated once, with a mechanical test:
would a developer type this name, or does a user read it?

## Consequences

**A Spanish-speaking Worker sees English URLs.** `/publish` rather than `/publicar`. This is the real
cost and it is accepted knowingly: the URL is the one identifier a user does see. Two things bound it
— the visible page is entirely `es-CO`, and no flow in this product requires reading or typing a path.

**It costs some Spanish-keyword SEO on the public surfaces.** `/` and the browsable list are public and
indexable and are how a Hirer finds this product at all. Spanish path segments would carry keyword
weight that English ones do not. Judged smaller than the cost of a bilingual identifier space, but it
is a genuine loss rather than a neutral trade, and if organic discovery ever becomes the growth path,
this is the decision to reopen — with localized paths as an additive routing layer over English
handlers, not by renaming the code.

**`docs/policy/ux.md` → `locales` is untouched.** It says `es-CO` only, and it still means every string
a person reads. This ADR narrows nothing about the product's language; it only says where the language
boundary falls.

**A committed advisory may contain the old Spanish paths.** `docs/efforts/*/advisories/` is verbatim
and `.claude/hooks/build-guard.sh` refuses edits to it, so effort 0002's four advisories still quote
`/perfiles` and `/propuesta/[id]`. That is a historical record of what was reviewed, not a live
reference, and it is correct that it does not change.
