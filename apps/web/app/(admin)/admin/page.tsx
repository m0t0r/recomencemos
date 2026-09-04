/**
 * `/admin` — the gate, and then the door to the section that leads.
 *
 * **This was one page holding all five sources**, and the shape interview (#96)
 * replaced it with a nav and one route per concern. What is left here is a
 * redirect, and the order of its two statements is the requirement rather than
 * an implementation detail.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin";
import { ADMIN_PAGE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: ADMIN_PAGE_TITLE,
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  /**
   * **The gate runs before the redirect**, which the API contract states in as
   * many words: an unauthenticated caller meets NFR14's 403 *here* and never
   * learns that the five section routes exist. Redirecting first would answer a
   * stranger with a `Location` header naming `/admin/offers` — a sign saying
   * which routes are worth attacking, which is the disclosure answering 403
   * rather than redirecting exists to avoid.
   *
   * The shell above this calls the same gate, and this call is not redundant:
   * a layout and its page render concurrently, so the layout's refusal is racing
   * this redirect rather than preceding it.
   */
  await requireAdminPage();

  /**
   * **Offers lead because they are the only source with a deadline attached** —
   * NFR7's band is per Offer, and a Report or a Skill request has no equivalent
   * clock. That is also why this is a redirect rather than an overview page: an
   * overview would be a sixth screen holding summaries of five, and the sidebar
   * already carries every count.
   */
  redirect("/admin/offers");
}
