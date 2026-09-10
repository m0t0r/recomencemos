/**
 * PROTOTYPE — one lab page: reads `?variant=` inside a `<Suspense>` boundary
 * (Cache Components refuses a `searchParams` read outside one — `[stream]`
 * from the framework's own menu) and hands the chosen variant to `render`.
 */

import { Suspense } from "react";
import { type LabVariant, readVariant, type SearchParams } from "../_lib/variant";
import { LabFrame } from "./lab-frame";

interface LabPageProps {
  readonly idea: string;
  readonly question: string;
  readonly variants: readonly LabVariant[];
  readonly searchParams: SearchParams;
  readonly render: (current: LabVariant) => React.ReactNode;
}

async function Body({ idea, question, variants, searchParams, render }: LabPageProps) {
  const current = await readVariant(searchParams, variants);
  return (
    <LabFrame idea={idea} question={question} variants={variants} current={current}>
      {render(current)}
    </LabFrame>
  );
}

export function LabPage(props: LabPageProps) {
  return (
    <Suspense fallback={null}>
      <Body {...props} />
    </Suspense>
  );
}
