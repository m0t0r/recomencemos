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
