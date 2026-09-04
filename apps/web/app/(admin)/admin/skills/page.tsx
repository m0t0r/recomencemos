/**
 * `/admin/skills` — Skill requests, and the only section with a resolver today.
 *
 * **It is live because story 3 shipped both halves of its own loop**: a queue
 * item whose resolver belongs to a lower-priority story is a queue item that
 * accumulates, so the source and the promotion that empties it arrived together.
 * The row shape and its affordances are #109's; what is here is the row that has
 * been working since, moved onto the route the shape interview gave it.
 */

import { QueueSection } from "../_components/section";
import { SKILL_REQUESTS_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(SKILL_REQUESTS_LABEL);

export default function SkillsSectionPage() {
  return <QueueSection segment="skills" />;
}
