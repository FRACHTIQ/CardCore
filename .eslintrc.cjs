/** @type {import("eslint").Linter.Config} */
module.exports = {
  env: { node: true, es2022: true },
  extends: ["eslint:recommended"],
  parserOptions: { ecmaVersion: "latest" },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
  },
};
