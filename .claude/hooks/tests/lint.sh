# The lint configuration here that is a gate in its own right, and there are two pieces of it.
#
# The first: a component test finds what it asserts on through the accessibility tree, and raw DOM
# access is refused (#261). It is oxlint configuration rather than a script, so there is no
# branching of ours to test -- what those cases pin is that the configuration still *runs*.
#
# The second is ours: `repo/react-namespace-import`, from `scripts/oxlint-plugin.mjs`. That one has
# branching, so its cases pin what it refuses and what its fix writes as well as that it loads.
# They live here rather than in a file named for the script because they need the same real
# configs, and the failure mode below -- a `jsPlugins` entry that quietly stops loading -- is
# shared by both.
#
# That is worth a suite because of how it can fail. The two rules come from
# `eslint-plugin-testing-library` through oxlint's `jsPlugins`, which oxlint's own
# schema calls alpha and outside semver. A release that stopped loading the
# plugin, or stopped honouring an `overrides` entry for a JS plugin's rules, would
# leave `pnpm lint` green on a tree full of `container.querySelector` -- the gate
# failing open, silently, on an upgrade nobody connected to it.
#
# Each case writes its fixture under $ROOT and lints it with a real config from
# this repository, so the fixtures are never under a path `pnpm lint` walks.
OXLINT="$REPO/node_modules/.bin/oxlint"
LINT="$ROOT/lint"
mkdir -p "$LINT"

lint_fixture() { # name config expect-exit expect-grep file
  expect_run "$1" "$3" "$4" -- "$OXLINT" -c "$REPO/$2" --no-ignore "$5"
}

# A clean run prints nothing, and so does a run that linted nothing -- a path
# that stopped matching would pass every "allowed" case vacuously. The JSON
# report says how many files it read, so a pass has to have read this one.
lint_clean() { # name config file
  expect_run "$1" 0 '"number_of_files": 1' -- "$OXLINT" -c "$REPO/$2" --no-ignore -f json "$3"
}

cat > "$LINT/container.test.tsx" <<'EOF'
import { render } from "@testing-library/react";
test("a form", () => {
  const { container } = render(<form action="/x" />);
  expect(container.querySelector("form")).not.toBeNull();
});
EOF

cat > "$LINT/node-access.test.tsx" <<'EOF'
import { render, screen } from "@testing-library/react";
test("a time", () => {
  render(<p role="status"><time dateTime="PT1S">1</time></p>);
  expect(screen.getByRole("status").querySelector("time")).not.toBeNull();
});
EOF

cat > "$LINT/closest.test.tsx" <<'EOF'
import { render, screen } from "@testing-library/react";
test("a row", () => {
  render(<ul><li>Ana</li></ul>);
  expect(screen.getByText("Ana").closest("li")).not.toBeNull();
});
EOF

# What the rules must still allow: role queries, and the form's own submission
# API reached from a control the tree found. `CLAUDE.md` names this as the
# route for a question about what a form posts.
cat > "$LINT/accessible.test.tsx" <<'EOF'
import { render, screen, within } from "@testing-library/react";
test("a form", () => {
  render(<form action="/x"><button>Enviar</button><p role="status"><time dateTime="PT1S">1</time></p></form>);
  const form = screen.getByRole("button", { name: "Enviar" }).form;
  expect(form).toHaveAttribute("action", "/x");
  expect([...new FormData(form!).keys()]).toEqual([]);
  expect(within(screen.getByRole("status")).getByRole("time")).toHaveAttribute("datetime", "PT1S");
});
EOF

# The same raw access outside a test file is ordinary DOM code, and the rules
# are scoped to tests on purpose.
cp "$LINT/container.test.tsx" "$LINT/not-a-test.tsx"

section "testing-library rules (root config)"
lint_fixture "container.querySelector in a test is refused" .oxlintrc.json 1 \
  'testing-library\(no-container\)' "$LINT/container.test.tsx"
lint_fixture "querySelector on a query result is refused" .oxlintrc.json 1 \
  'testing-library\(no-node-access\)' "$LINT/node-access.test.tsx"
lint_fixture ".closest on a query result is refused" .oxlintrc.json 1 \
  'testing-library\(no-node-access\)' "$LINT/closest.test.tsx"
lint_clean "role queries and the form's own API pass" .oxlintrc.json "$LINT/accessible.test.tsx"
lint_clean "the same access outside a test file passes" .oxlintrc.json "$LINT/not-a-test.tsx"

# `plugins` overwrites rather than merges in a nested config, so each workspace
# that restates it is checked to still inherit `jsPlugins` and the override.
section "testing-library rules (workspace configs)"
lint_fixture "apps/web inherits the refusal" apps/web/.oxlintrc.json 1 \
  'testing-library\(no-container\)' "$LINT/container.test.tsx"
lint_fixture "design-system inherits the refusal" packages/design-system/.oxlintrc.json 1 \
  'testing-library\(no-container\)' "$LINT/container.test.tsx"

# The repository's own rule, from `scripts/oxlint-plugin.mjs` through the same `jsPlugins` door:
# React is reached through one namespace import and nothing is pulled out of it by name. A local
# path in `jsPlugins` is the part most likely to stop resolving from a config that `extends` the
# root, so each workspace that renders React is checked to still load it.
cat > "$LINT/react-named.tsx" <<'EOF'
import { useState } from "react";
export const useCount = () => useState(0);
EOF

cat > "$LINT/react-type.tsx" <<'EOF'
import type { ReactNode } from "react";
export const Slot = (props: { children: ReactNode }) => props.children;
EOF

cat > "$LINT/react-default.tsx" <<'EOF'
import React from "react";
export const Empty = () => React.createElement("p");
EOF

cat > "$LINT/react-reexport.ts" <<'EOF'
export { useState } from "react";
EOF

cat > "$LINT/react-namespace.tsx" <<'EOF'
import * as React from "react";
export function Slot(props: { children: React.ReactNode }) {
  const [count] = React.useState(0);
  return <React.Suspense fallback={count}>{props.children}</React.Suspense>;
}
EOF

# The fix is how the repository was migrated, so it is pinned too: a value import and a type
# import in one file, a shorthand property, a JSX tag pair, and a directive whose text is a hook's
# name. One pass has to leave a single namespace import and nothing else to report.
cat > "$LINT/react-fix.tsx" <<'EOF'
"use client";
import { Suspense, useState, type ReactNode } from "react";
import type { RefObject } from "react";
export function Probe(props: { children: ReactNode; r: RefObject<null> }) {
  const [count] = useState(0);
  const hooks = { useState };
  return <Suspense fallback={count}>{props.children}{String(hooks)}</Suspense>;
}
EOF
"$OXLINT" -c "$REPO/.oxlintrc.json" --no-ignore -A all -D repo/react-namespace-import --fix \
  "$LINT/react-fix.tsx" >/dev/null 2>&1

# A type-only namespace import is not the allowed form. Accepted, it would survive a fix that
# deleted the value import beside it, and `React.useState` would then resolve through a name that
# does not exist at runtime.
cat > "$LINT/react-type-namespace.tsx" <<'EOF'
import type * as React from "react";
export const Slot = (props: { children: React.ReactNode }) => props.children;
EOF

cat > "$LINT/react-fix-type.tsx" <<'EOF'
import type * as React from "react";
import { useState } from "react";
export const useCount = () => useState(0);
export type Slot = React.ReactNode;
EOF
"$OXLINT" -c "$REPO/.oxlintrc.json" --no-ignore -A all -D repo/react-namespace-import --fix \
  "$LINT/react-fix-type.tsx" >/dev/null 2>&1

# Two shapes the fix must refuse to touch rather than write wrong:
# a local re-export, which would become `export { React.useState }` and not parse, and a nested
# `React` binding, which would capture the rewritten reference and still compile. Each is linted
# after a `--fix` run, so a refusal that is still reported is also one the fix left alone.
cat > "$LINT/react-reexport-local.ts" <<'EOF'
import { useState } from "react";
export { useState };
EOF

cat > "$LINT/react-shadowed.ts" <<'EOF'
import { useState } from "react";
export function pair() {
  const React = 1;
  return [React, useState];
}
EOF
for fixture in react-reexport-local.ts react-shadowed.ts; do
  "$OXLINT" -c "$REPO/.oxlintrc.json" --no-ignore -A all -D repo/react-namespace-import --fix \
    "$LINT/$fixture" >/dev/null 2>&1
done

# A bare import pulls nothing out of React, so the rule has nothing to say about it.
cat > "$LINT/react-bare.ts" <<'EOF'
import "react";
EOF

section "react-namespace-import (root config)"
lint_fixture "a named hook import is refused" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-named.tsx"
lint_fixture "a named type import is refused" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-type.tsx"
lint_fixture "the default import is refused" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-default.tsx"
lint_fixture "a re-export from react is refused" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-reexport.ts"
lint_clean "the namespace import passes" .oxlintrc.json "$LINT/react-namespace.tsx"
lint_fixture "a type-only namespace import is refused" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-type-namespace.tsx"

section "react-namespace-import (workspace configs)"
lint_fixture "apps/web inherits the rule" apps/web/.oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-named.tsx"
lint_fixture "design-system inherits the rule" packages/design-system/.oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-named.tsx"
lint_fixture "notifications inherits the rule" packages/notifications/.oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-named.tsx"

section "react-namespace-import (fix)"
lint_clean "one fix pass leaves nothing to report" .oxlintrc.json "$LINT/react-fix.tsx"
expect_run "the fix leaves exactly one import from react" 0 '^1$' -- \
  grep -c 'from "react"' "$LINT/react-fix.tsx"
expect_run "a shorthand property keeps its key" 0 'hooks = \{ useState: React\.useState \}' -- \
  cat "$LINT/react-fix.tsx"
expect_run "a JSX tag pair is qualified at both ends" 0 \
  '<React\.Suspense fallback=\{count\}>.*</React\.Suspense>' -- cat "$LINT/react-fix.tsx"
expect_run "a type from the removed import is qualified" 0 'r: React\.RefObject<null>' -- \
  cat "$LINT/react-fix.tsx"
expect_run "the directive is untouched" 0 '^"use client";$' -- cat "$LINT/react-fix.tsx"
lint_clean "a type-only namespace beside a value import fixes in one pass" .oxlintrc.json \
  "$LINT/react-fix-type.tsx"
expect_run "the surviving namespace import is a value import" 0 \
  '^import \* as React from "react";$' -- cat "$LINT/react-fix-type.tsx"
lint_fixture "a local re-export is still refused after a fix run" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-reexport-local.ts"
expect_run "a local re-export is left for a person" 0 '^export \{ useState \};$' -- \
  cat "$LINT/react-reexport-local.ts"
lint_fixture "a shadowed React is still refused after a fix run" .oxlintrc.json 1 \
  'repo\(react-namespace-import\)' "$LINT/react-shadowed.ts"
expect_run "a shadowed React is left for a person" 0 '^  return \[React, useState\];$' -- \
  cat "$LINT/react-shadowed.ts"
lint_clean "a bare import passes" .oxlintrc.json "$LINT/react-bare.ts"
