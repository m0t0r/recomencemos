/**
 * **Prototype only.** How far the notebook world is taken on a profile form,
 * as three independent switches, so the five `?variant=` compositions on
 * `prototype/181-ui-variants` are the same fields in the same order under
 * different treatments rather than five hand-written forms that quietly differ
 * in something nobody chose.
 *
 * That is the honest shape for **this** prototype and not the general rule: the
 * question the owner is answering is how much of the world these two surfaces
 * should carry, so the variants have to differ in exactly that and in nothing
 * else. Where a prototype's question is composition — as #16's was — the
 * variants are separate layouts, and the registry beside them says so.
 *
 * When one is locked, the winner's values are inlined and this module leaves
 * with the losers.
 */

export interface FormTreatment {
  /**
   * The groups sit as sheets on a `ruled-page`: the rose margin line down the
   * left from `sm` up, a mark in the margin, and the ruling between them
   * instead of a `<Separator />`.
   */
  readonly sheets: boolean;
  /** Group legends in the display face at the 24 px step rather than the label step. */
  readonly displayHeadings: boolean;
  /** A chosen Skill and a chosen city are filled with ink rather than merely ticked. */
  readonly inkControls: boolean;
  /** Where the card that shows her words back to her sits, if anywhere. */
  readonly preview: "none" | "closing" | "thumb";
}

/** What `dev` renders today: the control the other four are read against. */
export const CURRENT: FormTreatment = {
  sheets: false,
  displayHeadings: false,
  inkControls: false,
  preview: "none",
};
