# Recomencemos

The platform connects people in Pereira, Dosquebradas and Santa Rosa (Risaralda, Colombia)
who lost their income in the 10 August 2026 earthquake with anyone, anywhere, willing to
pay them for work. It introduces the two sides and then steps out of the way.

## Language

**Spanish is the interface; English is the code.** Every term below has an English name and a Spanish
UI rendering, and the split is binding: the English name is what appears in route segments, file and
directory names, database tables and columns, enum values, query parameters, API field names, log
`event` names and test names. The Spanish rendering appears only in what a person reads. The line
falls between an **identifier** and a **value** — `Skill.labelEs` is an English column holding a
Spanish string, and that is the shape to copy. See
[ADR-0012](docs/adr/0012-spanish-is-the-interface-english-is-the-code.md).

So: the route is `/offers`, the table is `offer`, the entity is `Offer`, and the page says
_Propuesta_.

**Worker**:
A person who lost their source of income in the earthquake and publishes what they are able
and willing to do in exchange for pay. Spanish UI: _Trabajador/a_.
_Avoid_: Damnificado, victim, beneficiary, affected person, candidate, applicant, job seeker

**Hirer**:
A person, family, or organization offering to pay a Worker for work. May be anywhere in the
world, and is not required to be an employer in any formal sense. Spanish UI: _Contratante_.
_Avoid_: Employer, donor, sponsor, benefactor, good Samaritan, client

**CapabilityProfile**:
A Worker's public page: the Skills they hold and the terms under which they will work.
Spanish UI: _Perfil de capacidades_.
_Avoid_: CV, résumé, listing, case file

**WorkHistoryEntry**:
One line, in a Worker's own words, about a place she has worked, kept in the order she wrote
them. Part of the gated half of a CapabilityProfile: seen by a signed-in Account reading the full
profile, never on the Wall. Spanish UI: _Dónde has trabajado_.
_Avoid_: Employment history, CV, résumé, experience (as a section title)

**Skill**:
One entry from the platform's fixed vocabulary of human capabilities, chosen by a Worker for
their CapabilityProfile. Spanish UI: _Capacidad_.
_Avoid_: Tag, category, competency, service

**Offer**:
A concrete, immutable proposal of paid work sent by one Hirer to one named Worker, which the
Worker either accepts or rejects. Spanish UI: _Propuesta_.
_Avoid_: Job, vacancy, posting, gig, request, invitation

**Contact Exchange**:
The moment a Worker accepts an Offer and each side receives the other's contact details. It is
the platform's terminal event: everything after it happens off the platform.
_Avoid_: Match, connection, deal, hire, placement

**Account**:
One identity on the platform. It may hold a CapabilityProfile, it may send Offers, or both —
what a person is here is a consequence of what they have done, not a choice made at sign-up.
_Avoid_: User, member, profile, registration

**Wall**:
The public homepage list of the most recently published CapabilityProfiles. It is a teaser, not
the catalogue; the full browsable list is ordered to favour Workers who have received the fewest
Offers. Spanish UI: _Muro_.
_Avoid_: Feed, directory, listings, board

**Report**:
A Worker's assertion that an Offer she received is abusive. It hides the Offer from her, freezes the
Hirer — he can send nothing further, his undelivered Offers are held rather than rejected, and his
reading of any full profile is suspended — and waits for an Admin. The freeze is temporary and
reversible, which is why it reaches further than a Block. Spanish UI: _Reportar_.
_Avoid_: Flag, complaint, abuse ticket

**Block**:
A Worker's unilateral and permanent refusal of one Hirer: **he can send her nothing further**, and
that is the whole of it. Her public card stays public — the Wall is readable by anyone, signed in or
not — and he keeps whatever reading access any signed-in Account has. It reaches only the platform:
after Contact Exchange it cannot undo what he already knows, and it does not survive his deleting his
Account, because deletion frees his email address. Spanish UI: _Bloquear_.
_Avoid_: Ban, mute, hide — and avoid describing it as making her invisible, which it never was

**Admin**:
A staff Account. Holds the daily queue — photos, Offers, Reports — plus takedown, unfreeze, and
vocabulary promotion. The only role that can read Contact Exchange data in bulk.
_Avoid_: Moderator, staff, superuser, operator

**RateCounter**:
One row per principal, per ceilinged action, per time window — the record every ceiling in NFR26 is
counted against. Internal plumbing with no Spanish rendering, because nobody reads it: what a person
sees when a ceiling is reached is the refusal, in her own terms, with the time she may try again.
_Avoid_: Throttle, quota, bucket — and avoid calling the row a "limit", which is the policy rather
than the count
