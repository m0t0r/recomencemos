# The one piece of lint configuration here that is a gate in its own right: a component test finds
# what it asserts on through the accessibility tree, and raw DOM access is
# refused (#261). It is oxlint configuration rather than a script, so there is no
# branching of ours to test -- what these cases pin is that the configuration
# still *runs*.
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
