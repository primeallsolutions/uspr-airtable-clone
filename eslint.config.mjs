import next from "eslint-config-next";

// Use Next.js flat config directly (includes core-web-vitals + TypeScript support),
// with a few targeted overrides to align with existing code patterns.
const config = [
  ...next,
  {
    rules: {
      // Disable overly strict React rules that flag intentional state resets/refs usage
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default config;
