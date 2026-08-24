import { Badge } from "@repo/design-system/components/badge";
import { Showcase } from "./showcase";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary">Placeholder</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Design system ready</h1>
          <p className="text-muted-foreground text-sm">
            shadcn/ui on Base UI, shipped from{" "}
            <code className="font-mono">@repo/design-system</code>. Add more with{" "}
            <code className="font-mono">
              pnpm dlx shadcn@latest add &lt;component&gt; -c packages/design-system
            </code>
            .
          </p>
        </div>
      </header>

      <Showcase />
    </div>
  );
}
