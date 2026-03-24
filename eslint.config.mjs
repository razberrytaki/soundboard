import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".open-next/**",
      ".next/**",
      ".pnpm-store/**",
      ".superpowers/**",
      ".worktrees/**",
      "coverage/**",
      "dist/**",
    ],
  },
];

export default config;
