// This repository's own lint rules, loaded by the root `.oxlintrc.json` through `jsPlugins` —
// the same door `eslint-plugin-testing-library` comes through, and `.claude/hooks/tests/lint.sh`
// is what goes red if oxlint stops loading it.
//
// `react-namespace-import`: React is reached through one `import * as React from "react"`, and
// nothing is pulled out of it by name — not a hook, not a type, not the default export. Nothing
// off the shelf says that: oxlint's `no-restricted-imports` refuses the namespace import too once
// it is given any name list, and `eslint-react`'s `prefer-namespace-import` only ever refused the
// default import and was dropped by its v5.
//
// The fix is the whole refactor. Every reference to a named binding is rewritten through the
// scope manager rather than by text search, so `"use client"` is never read as a `use` call and a
// shorthand `{ useState }` becomes a property rather than a syntax error.

const SOURCE = "react";
const NAMESPACE = "React";

/** The text a reference to `specifier`'s binding becomes once the namespace is the only import. */
function qualified(specifier) {
  if (specifier.type === "ImportDefaultSpecifier") return NAMESPACE;
  if (specifier.type === "ImportNamespaceSpecifier") return NAMESPACE;
  const imported = specifier.imported;
  return `${NAMESPACE}.${imported.type === "Identifier" ? imported.name : imported.value}`;
}

/** A declaration that already is the one allowed form. */
function isNamespaceImport(node) {
  return (
    node.specifiers.length === 1 &&
    node.specifiers[0].type === "ImportNamespaceSpecifier" &&
    node.specifiers[0].local.name === NAMESPACE
  );
}

/** The declaration's range, widened over the line break after it so a removal leaves no gap. */
function wholeLine(sourceCode, node) {
  const end = sourceCode.text[node.range[1]] === "\n" ? node.range[1] + 1 : node.range[1];
  return [node.range[0], end];
}

const reactNamespaceImport = {
  meta: {
    type: "suggestion",
    docs: { description: 'Import React only as `import * as React from "react"`.' },
    fixable: "code",
    messages: {
      namespace: 'Import React as `import * as React from "react"` and reach {{what}} through it.',
      reexport: 'Re-exporting from "react" pulls names out of it; import the namespace instead.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const declarations = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value === SOURCE) declarations.push(node);
      },
      ExportNamedDeclaration(node) {
        if (node.source?.value === SOURCE) context.report({ node, messageId: "reexport" });
      },
      ExportAllDeclaration(node) {
        if (node.source.value === SOURCE) context.report({ node, messageId: "reexport" });
      },
      "Program:exit"() {
        const offending = declarations.filter((node) => !isNamespaceImport(node));
        if (offending.length === 0) return;

        // One declaration survives as the namespace import: an existing correct one if the file
        // has it, otherwise the first offender is rewritten into it. Every other one is removed,
        // so a file with a value import and a type import does not end up importing React twice.
        const survivor = declarations.find(isNamespaceImport) ?? offending[0];

        // The whole file's rewrite rides on the first report alone. oxlint merges a report's fixes
        // into one span and applies no two overlapping spans in a pass, so one fix per declaration
        // left every declaration after the first for a second `--fix` run.
        function fixAll(fixer) {
          const fixes = [];
          for (const node of offending) {
            fixes.push(
              node === survivor
                ? fixer.replaceText(node, `import * as ${NAMESPACE} from "${SOURCE}";`)
                : fixer.replaceTextRange(wholeLine(sourceCode, node), ""),
            );
            for (const specifier of node.specifiers) {
              const replacement = qualified(specifier);
              for (const variable of sourceCode.getDeclaredVariables(specifier)) {
                for (const { identifier } of variable.references) {
                  if (identifier.name === replacement) continue;
                  const parent = identifier.parent;
                  // `{ useState }` is a key and a value in one token; only the value moves.
                  const text =
                    parent?.type === "Property" && parent.shorthand
                      ? `${identifier.name}: ${replacement}`
                      : replacement;
                  fixes.push(fixer.replaceText(identifier, text));
                }
              }
            }
          }
          return fixes;
        }

        for (const node of offending) {
          const what = node.specifiers
            .map((specifier) =>
              specifier.type === "ImportSpecifier" ? `\`${qualified(specifier)}\`` : null,
            )
            .filter(Boolean);

          context.report({
            node,
            messageId: "namespace",
            data: { what: what.length > 0 ? what.join(", ") : "everything" },
            ...(node === offending[0] ? { fix: fixAll } : {}),
          });
        }
      },
    };
  },
};

export default {
  meta: { name: "repo" },
  rules: { "react-namespace-import": reactNamespaceImport },
};
