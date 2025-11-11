/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  // Use the conventional commits preset (feat, fix, chore, etc.)
  extends: ["@commitlint/config-conventional"],

  rules: {
    // Keep subject short and consistent
    "header-max-length": [2, "always", 100],
    "subject-full-stop": [2, "never", "."],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],

    // Prefer kebab/lower-case scopes (e.g., parser, cli, http-client)
    "scope-case": [2, "always", ["kebab-case", "lower-case"]],

    // Limit line lengths in body/footer for readability
    "body-max-line-length": [2, "always", 100],
    "footer-max-line-length": [2, "always", 100],

    // Allowed types aligned with common conventions
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
};
