module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "branch-prefix-validation": (parsed) => {
          const { raw } = parsed;
          const pattern =
            /^\[(.*?)\] (feat|fix|docs|chore|style|refactor|ci|test|revert|perf)(\(.*\))?: (.+)$/;

          if (!pattern.test(raw)) {
            return [
              false,
              "Commit message must be in format: [branch] type(scope?): subject\n" +
                "Example: [main] feat(auth): add login functionality",
            ];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    "branch-prefix-validation": [2, "always"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "chore",
        "style",
        "refactor",
        "ci",
        "test",
        "revert",
        "perf",
      ],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
