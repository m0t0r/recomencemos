/**
 * NFR16 at seam 2, under NFR10's sentinel discipline.
 *
 * **The export is a whitelist, and a whitelist is only honest if something counts
 * the values.** The test that asserts field by field on a hand-built expectation
 * passes forever while a `personal` column added next year is silently missing —
 * which is precisely the bug an export has, and the one a *consulta* discovers
 * ten business days into its clock. So the fixture puts a **distinct sentinel in
 * every column that holds something about her**, and the assertions count
 * occurrences in the serialised export: every sentinel present, and the two
 * `secret` values absent.
 *
 * It runs at seam 2 rather than seam 1 because the whitelist is a `select` list.
 * The mistake being guarded against is a column omitted from that list, and a
 * pure test over a hand-made object cannot see one.
 */

import { eq, getTableColumns } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS, recordConsent } from "#consent/index";
import { buildSubjectAccessExport } from "#export";
import { publishProfile } from "#profiles";
import * as schema from "#schema";
import { signedInAccountId } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

/**
 * One sentinel per `personal` value the schema holds today, each unmistakable in
 * a JSON dump and each unlike the others.
 */
const SENTINEL = {
  email: "sentinel-email@recomencemos.test",
  name: "SentinelNombreCompleto",
  image: "https://example.test/sentinel-avatar.png",
  fullName: "SentinelNombreEnElPerfil",
  firstName: "SentinelPrimerNombre",
  headline: "SentinelUnaLinea",
  about: "SentinelDescripcion",
  phone: "+573009876543",
  workHistory: "SentinelHistorialDeTrabajo",
  // The two self-asserted fields a Hirer gives on his first Offer (story 6).
  // Distinct from `name` and `phone` above on purpose: those are the Worker
  // half, and a shared sentinel would let the export carry one and pass for both.
  hirerName: "SentinelNombreDeQuienEnvia",
  hirerPhone: "+573001112233",
  // The three things one person wrote to another (story 6). `personal`, held
  // about both of them, and the export carries them from whichever side.
  workDescription: "SentinelDescripcionDelTrabajo",
  payTerms: "SentinelCondicionesDePago",
  whenText: "SentinelCuandoEsElTrabajo",
} as const;

async function anAccountWithEverything(database: TestDatabase): Promise<string> {
  const accountId = await signedInAccountId(database, SENTINEL.email);

  // Google's door fills both of these; the magic-link door fills neither, so they
  // are set here rather than left empty. An export tested only against a
  // magic-link Account would never see them.
  // `hirerName` and `hirerPhone` are set here rather than through `sendOffer`
  // for the reason `name` and `image` are: what is under test is whether the
  // export's `select` list reaches every column, and driving another aggregate's
  // whole transaction to fill two of them would make this fixture depend on
  // story 6's refusals rather than on the schema.
  await database.db
    .update(schema.user)
    .set({
      name: SENTINEL.name,
      image: SENTINEL.image,
      hirerName: SENTINEL.hirerName,
      hirerPhone: SENTINEL.hirerPhone,
    })
    .where(eq(schema.user.id, accountId));

  // The Worker consent arrives with the profile, through the module that owns
  // both — a hand-inserted profile would drift from the schema on its first
  // added column.
  const published = await publishProfile(database.db, accountId, {
    fullName: SENTINEL.fullName,
    firstName: SENTINEL.firstName,
    lastInitial: "S",
    city: "pereira",
    headline: SENTINEL.headline,
    about: SENTINEL.about,
    phone: SENTINEL.phone,
    skillSlugs: ["home-cooking"],
    workHistory: [SENTINEL.workHistory],
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });
  if (!published.ok) throw new Error("the fixture profile did not publish");

  await database.db.transaction(async (tx) => {
    await recordConsent(tx, { accountId, side: "hirer", versions: CURRENT_CONSENT_VERSIONS });
  });

  await anOfferSentBy(database, accountId);

  return accountId;
}

/**
 * One Offer this Account sent, so the export has both sides of a person in it.
 *
 * **Addressed to somebody else's profile**, which is what makes `side` mean
 * something: a row matching both keys at once would be an Offer to oneself,
 * which `sendOffer` refuses and which would leave this fixture unable to tell
 * the two sides apart.
 *
 * Inserted directly for the reason `hirerName` above is: what is under test is
 * whether the export's `select` list reaches every column, and driving another
 * aggregate's whole transaction would make this fixture depend on story 6's
 * refusals rather than on the schema.
 */
async function anOfferSentBy(database: TestDatabase, accountId: string): Promise<void> {
  await database.db.insert(schema.user).values({
    id: "the-addressee",
    name: "",
    email: "addressee@recomencemos.test",
    emailVerified: true,
  });

  const [addressee] = await database.db
    .insert(schema.capabilityProfile)
    .values({
      accountId: "the-addressee",
      slug: "k7m2qx6vb4tn5rzd",
      fullName: "Luz Marina Ospina",
      firstName: "Luz",
      lastInitial: "O",
      city: "pereira",
      headline: "Arreglo tuberías y baños",
      phone: "+573005556677",
      searchText: "luz pereira tuberias",
    })
    .returning({ id: schema.capabilityProfile.id });

  await database.db.insert(schema.offer).values({
    capabilityProfileId: (addressee as { id: bigint }).id,
    hirerAccountId: accountId,
    workDescription: SENTINEL.workDescription,
    payTerms: SENTINEL.payTerms,
    whenText: SENTINEL.whenText,
  });
}

describe("the subject-access export", () => {
  test("carries every sentinel it holds about her", async ({ database }) => {
    const accountId = await anAccountWithEverything(database);
    const dump = JSON.stringify(await buildSubjectAccessExport(database.db, accountId));

    for (const [field, sentinel] of Object.entries(SENTINEL)) {
      expect(dump, `the ${field} sentinel is missing from the export`).toContain(sentinel);
    }
  });

  test("carries the consent record, per side and with its versions", async ({ database }) => {
    const accountId = await anAccountWithEverything(database);
    const subject = await buildSubjectAccessExport(database.db, accountId);

    expect(subject?.consents).toHaveLength(2);
    expect(subject?.consents.map((consent) => consent.side)).toEqual(["worker", "hirer"]);

    for (const consent of subject?.consents ?? []) {
      expect(consent).toMatchObject({
        noticeVersion: CURRENT_CONSENT_VERSIONS.notice,
        authorizationVersion: CURRENT_CONSENT_VERSIONS.authorization,
        transmissionAcknowledged: true,
      });
      expect(consent.consentedAt).toBeInstanceOf(Date);
    }
  });

  /**
   * C28, and the exclusion that is easiest to mistake for an oversight.
   *
   * A session token and a magic-link token are credentials. Handing a *titular*
   * her own session token is a credential disclosure rather than habeas data, so
   * the test names both tables and asserts their values never reach the dump —
   * which is also what stops a later "the export should be complete" edit adding
   * them back.
   */
  test("carries no session token and no verification token", async ({ database }) => {
    const accountId = await anAccountWithEverything(database);

    const sessions = await database.db
      .select({ token: schema.session.token })
      .from(schema.session)
      .where(eq(schema.session.userId, accountId));

    const verifications = await database.db
      .select({ identifier: schema.verification.identifier, value: schema.verification.value })
      .from(schema.verification);

    expect(sessions.length).toBeGreaterThan(0);

    const dump = JSON.stringify(await buildSubjectAccessExport(database.db, accountId));

    for (const session of sessions) expect(dump).not.toContain(session.token);
    for (const verification of verifications) {
      expect(dump).not.toContain(verification.identifier);
    }
  });

  // An ordinary answer to a consulta about an address that never registered here,
  // and not a fault — so it is a value rather than a throw.
  test("is null for an Account that does not exist", async ({ database }) => {
    expect(await buildSubjectAccessExport(database.db, "no-such-account")).toBeNull();
  });

  // An export read by a person is a history, and a history reads forwards.
  test("orders the consents oldest first", async ({ database }) => {
    const accountId = await anAccountWithEverything(database);
    const subject = await buildSubjectAccessExport(database.db, accountId);

    const times = (subject?.consents ?? []).map((consent) => consent.consentedAt.getTime());
    expect(times.toSorted((a, b) => a - b)).toEqual(times);
  });
});
/**
 * **The half a hand-kept sentinel list cannot cover.**
 *
 * The sentinels above prove that what the export claims to carry actually
 * reaches the wire. They cannot prove the claim is *complete*: a `personal`
 * column added next year and left out of both the `select` list and the fixture
 * passes every assertion above, green and silent. DD8 asks for the opposite — "a
 * new `personal` column omitted from it fails the same class of sentinel test" —
 * and that is a statement about the schema rather than about a fixture.
 *
 * So the columns are read out of the tables themselves, and every one has to be
 * **classified**: either it reaches the export, or it is named excluded with the
 * reason beside it. A column that is neither is a column nobody has decided
 * about, and it is red until somebody does.
 */

/**
 * The column-to-export-field map, as a claim this suite checks rather than a
 * comment. The value is the field name as it appears on the wire, which is what
 * makes the second test a real read of the projection.
 */
const EXPORTED_BY_COLUMN: Record<string, string> = {
  "user.email": "email",
  "user.name": "name",
  "user.emailVerified": "emailVerified",
  "user.image": "imageUrl",
  // A decision this platform took about the person reading the export, and one
  // that suspends what she may do here — the opposite case from `isAdmin` below.
  "user.offerSendingState": "offerSendingState",
  // Held about him and disclosed to somebody else: a Worker reads both on every
  // Offer he sends, so an export omitting them would omit the fields with the
  // widest audience.
  "user.hirerName": "hirerName",
  "user.hirerPhone": "hirerPhone",
  "user.createdAt": "registeredAt",
  "consent.side": "side",
  "consent.noticeVersion": "noticeVersion",
  "consent.authorizationVersion": "authorizationVersion",
  "consent.transmissionAcknowledged": "transmissionAcknowledged",
  "consent.createdAt": "consentedAt",
  "capability_profile.slug": "slug",
  "capability_profile.fullName": "fullName",
  "capability_profile.firstName": "firstName",
  "capability_profile.lastInitial": "lastInitial",
  "capability_profile.city": "city",
  "capability_profile.headline": "headline",
  "capability_profile.about": "about",
  "capability_profile.phone": "phone",
  "capability_profile.photoState": "photoState",
  "capability_profile.photoAttachedAt": "photoAttachedAt",
  "capability_profile.state": "state",
  // Her Pause: a decision she took about her own visibility, which she has
  // every reason to be able to read back — and `personal`, like its neighbours.
  "capability_profile.pausedAt": "pausedAt",
  "capability_profile.publishedAt": "publishedAt",
  "capability_profile.deliveredOfferCount": "deliveredOfferCount",
  // The position is the order of the array, and the text is its items.
  "work_history_entry.position": "workHistory",
  "work_history_entry.text": "workHistory",
  // Both halves of the join reach the export as the Skill labels she chose.
  "profile_skill.capabilityProfileId": "skills",
  "profile_skill.skillId": "skills",
  // Three things one person wrote to another, held about both of them.
  "offer.workDescription": "workDescription",
  "offer.payTerms": "payTerms",
  "offer.whenText": "whenText",
  "offer.state": "state",
  "offer.createdAt": "sentAt",
  "offer.deliveredAt": "deliveredAt",
  // Which side of the Offer this Account stands on, derived from which key
  // matched rather than stored — so a row cannot be mislabelled.
  "offer.hirerAccountId": "side",
};

/**
 * Columns the export deliberately does not carry. Each entry is a decision, not
 * an oversight — which is the difference this list exists to record.
 */
const EXCLUDED: Record<string, string> = {
  // Surrogate keys. Both reach no URL and mean nothing to the person reading her
  // own export.
  "user.id": "a surrogate key, and not a fact about her",
  "consent.id": "a surrogate key, and not a fact about her",
  // The Admin grant is `internal`: a fact about how this platform is staffed
  // rather than about the person the export is for.
  "user.isAdmin": "internal — how the platform is staffed, not who she is",
  // Moves on every write and answers nothing a *titular* asked; `registeredAt`,
  // from `createdAt`, is the date she would actually want.
  "user.updatedAt": "bookkeeping, superseded by registeredAt",
  // The export is already scoped to her, so the join column tells her nothing.
  "consent.accountId": "the join this export is already scoped by",
  "capability_profile.id": "a surrogate key, and not a fact about her",
  "capability_profile.accountId": "the join this export is already scoped by",
  // A locator into a bucket says nothing to her; the photo ticket owns
  // exporting the object it points at.
  "capability_profile.photoKey": "an internal storage locator, not the photo",
  // The store's name for the bytes under that locator, kept so that what an
  // Admin approved is what gets published. It is about our own review gate
  // rather than about her, it exists only while a photo is waiting, and it
  // tells her nothing the photo itself does not — the photo ticket owns
  // exporting the object.
  "capability_profile.photoEtag": "an integrity check on the object, not a fact about her",
  // NFR22's daily-rewritten ordering input: how the browse list is shuffled,
  // not a fact about her.
  "capability_profile.rotationKey": "internal — a browse-ordering input, not who she is",
  // Derived, at write time, from four fields the export already carries.
  "capability_profile.searchText": "derived from firstName, city, headline and the Skills",
  "capability_profile.createdAt": "bookkeeping, superseded by publishedAt",
  "capability_profile.updatedAt": "bookkeeping, superseded by publishedAt",
  "work_history_entry.id": "a surrogate key, and not a fact about her",
  "work_history_entry.capabilityProfileId": "the join this export is already scoped by",
  "work_history_entry.createdAt": "bookkeeping; the profile's publishedAt is the date",
  "profile_skill.createdAt": "bookkeeping; the profile's publishedAt is the date",
  "offer.id": "a surrogate key; it reaches a URL she holds, not a fact about her",
  // The export is served to one person about herself, and naming the other party
  // would make a habeas data request a way of learning about somebody who did
  // not make one.
  "offer.capabilityProfileId": "the counterpart, deliberately withheld",
  /**
   * **A Block is her decision about him, and it is hers alone.**
   *
   * Exported to *her* it would be a fact about a person she chose not to
   * explain herself about; exported to *him* it would tell him he was Blocked,
   * which is precisely what `CONTEXT.md` and this product's copy refuse to say
   * — it is permanent and reasonless by design, and an export is not the door
   * that reveals it. Story 13's deletion still reaches the rows.
   */
  "block.workerProfileId": "her decision about him; disclosed to neither party",
  "block.hirerAccountId": "her decision about him; disclosed to neither party",
  "block.createdAt": "her decision about him; disclosed to neither party",
};

/**
 * The tables the classification check reads.
 *
 * **A table absent from here is a table nobody has decided about**, and that is
 * a bigger hole than an undecided column: story 6 added `offer` with three
 * `personal` free-text columns and `block`, and neither was covered until they
 * were added below — the guard reported a clean tree over five tables while two
 * new ones sat outside it. A story that adds a table adds its row here in the
 * same change.
 */
const TABLES = {
  user: schema.user,
  consent: schema.consent,
  capability_profile: schema.capabilityProfile,
  work_history_entry: schema.workHistoryEntry,
  profile_skill: schema.profileSkill,
  offer: schema.offer,
  block: schema.block,
};

const COLUMNS = Object.entries(TABLES).flatMap(([table, definition]) =>
  Object.keys(getTableColumns(definition)).map((column) => `${table}.${column}`),
);

describe("every column is classified", () => {
  // Pure, and the one that goes red when a column lands with nobody's decision
  // attached to it. No database: the question is about the schema.
  it.each(COLUMNS)("%s is either carried or named excluded", (column) => {
    const decided = column in EXPORTED_BY_COLUMN || column in EXCLUDED;

    expect(
      decided,
      `${column} is neither carried by the export nor named in EXCLUDED. Decide ` +
        "which it is: add it to the projection in `export.ts` and to " +
        "EXPORTED_BY_COLUMN, or name it excluded with the reason.",
    ).toBe(true);
  });

  it.each(Object.entries(EXCLUDED))("%s is excluded for a stated reason", (_column, reason) => {
    expect(reason.trim().length).toBeGreaterThan(0);
  });

  // And the other direction: a field this map claims is carried has to actually
  // be on the object that crosses. Renaming a key in `export.ts` without
  // updating the map is then red rather than quietly wrong.
  test("every field the map claims is on the wire", async ({ database }) => {
    const accountId = await anAccountWithEverything(database);
    const subject = await buildSubjectAccessExport(database.db, accountId);

    const consent = subject?.consents[0];
    expect(consent).toBeDefined();

    const offer = subject?.offers[0];
    expect(offer, "the fixture Account is party to no Offer").toBeDefined();

    const onTheWire = new Set([
      ...Object.keys(subject?.account ?? {}),
      ...Object.keys(consent ?? {}),
      ...Object.keys(subject?.profile ?? {}),
      ...Object.keys(offer ?? {}),
    ]);

    for (const field of Object.values(EXPORTED_BY_COLUMN)) {
      expect(onTheWire, `the export no longer carries ${field}`).toContain(field);
    }
  });
});
