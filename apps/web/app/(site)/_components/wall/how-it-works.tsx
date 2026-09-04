/**
 * How the product works, as the three-step sequence it is.
 *
 * **Numbered because it is a sequence.** Publishing happens before an Offer, an
 * Offer before a decision, and the third step is where the platform stops. The
 * numerals are set in the display face and in ink — the one place a large
 * numeral belongs — and the `<ol>` carries the order for anyone not looking.
 *
 * It says what the platform does and nothing about what it does not: the two
 * standing notices are story 11's, and a half-version here would give them a
 * second source. Every sentence is in `_lib/wall/messages.ts` and under the copy
 * test.
 */

import { HOW_HEADING, HOW_STEPS } from "../../_lib/wall/messages";

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
      <h2 id="how-heading" className="page-heading">
        {HOW_HEADING}
      </h2>
      <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
        {HOW_STEPS.map((step, index) => (
          <li key={step.title} className="border-border flex flex-col gap-3 border-t pt-5">
            <span aria-hidden="true" className="font-heading text-primary text-4xl leading-none">
              {index + 1}
            </span>
            <h3 className="font-heading text-foreground text-xl leading-6 font-medium">
              {step.title}
            </h3>
            <p className="text-muted-foreground text-pretty">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
