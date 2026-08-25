# A Worker's full identity is gated, and no profile is ever indexed

A public CapabilityProfile carries a first name, a last initial, a city, a moderated photo, the
Skills selected, and one line in the Worker's own words. Her **full name, full self-description,
and work history sit behind an Account**, every full profile is served `noindex`, and her phone
and email are released to nobody until she accepts an Offer.

The profile describes **what she can do**. It does not carry what she lost. There is no loss
narrative field, by design.

## Why

The fundraising instinct runs the other way — a full name, a face, and a story about the night
the building came down is what moves a stranger to act, and the pull is real. It was rejected
because of what it leaves behind.

A page reading _"María Fernanda Ospina · Dosquebradas · lost everything in the earthquake"_,
indexed by Google, is permanent. The earthquake is an event in her life; the search result is a
condition of it. In five years she is applying for an ordinary job and that page is still the
first thing a stranger finds under her name, still describing her at her worst month, long after
it stopped being true. We would have created that artifact on her behalf, from a form she filled
in while displaced, and we cannot delete it from the caches and scrapers that copied it.

Under [ADR-0008](0008-open-enrolment-with-published-non-verification.md) nobody is verified, which
makes this worse rather than better: the same open surface that lets anyone publish lets anyone
harvest.

## Consequences

**The emotional force has to come from capability and voice, not from damage.** One line in her
own words about what she does, and a face. That is a harder page to write and the right one — it
is also precisely the CEO's framing: _this is who I am, this is what I know how to do_.

**The `noindex` is load-bearing and easy to lose.** Any future change that makes full profiles
publicly reachable — a share link, an SEO push, an embed — reverses this decision whether or not
anyone intends it. The gate is the Account requirement; the `noindex` is the backstop.

**The Wall stays public and indexable**, carrying only the fields listed above. Discovery must not
require registration, because the Hirer is the scarce side.

**Full name is released at Contact Exchange**, at which point she has read complete Offer terms
and chosen. That is the moment consent exists, and it is the only moment identity crosses.

## Amendment (proposed, 2026-08-25) — collecting a name is not crossing one

This ADR says *where* a full name is released and never says *where it is collected*, and the two
readings of that silence produce different products. Effort 0002's concern C1 forced the question:
`ExchangedContact.fullName` had no source anywhere in the design.

**The amendment: her full name is collected at publish and released at Contact Exchange.** It is a
`personal` field on the CapabilityProfile — gated at rest, absent from the public card **and** from
the gated profile a signed-in Hirer reads, reaching him only in the exchange payload. Everything the
Consequences above say about crossing is unchanged; what is added is that the collection happens
earlier and is invisible until that moment.

**Why not collect it at acceptance**, which is the minimal-collection reading. Acceptance is the
highest-stakes action in the product, taken on a phone, in the moment she is deciding — a new required
input there is friction where it costs most, and a blank or joke name typed under pressure is
unfixable afterwards. The marginal privacy cost of asking at publish is small, because publish already
takes her **phone number** ([intent Q1](../efforts/0002-profile-to-contact-exchange/intent.md)); the
database is already one of reachable people, and a name adds little to that exposure.

**What forced it now: two sign-in doors return different things.** Google returns a real name at
sign-up and a magic link returns none. Without a collection point of its own, a Contact Exchange would
deliver a full name for a Worker who signed in with Google and nothing for one who used email — an
identity guarantee that depends on which button she pressed. Collecting at publish makes the two doors
produce the same exchange, with the Google value prefilled and editable rather than authoritative.

**Accepting this amendment is a human's act**, the same as approving the spec that proposes it.
