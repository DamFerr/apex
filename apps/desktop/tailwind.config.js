const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
/** Colors come from CSS variables so themes are token swaps. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: c("base"), surface: c("surface"), raised: c("raised"),
        line: c("line"), text: c("text"), muted: c("muted"),
        accent: c("accent"), gold: c("gold"), good: c("good"), bad: c("bad"),
      },
      fontFamily: {
        sans: ["Inter Variable", "system-ui", "sans-serif"],
        display: ["Space Grotesk Variable", "Inter Variable", "sans-serif"],
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px", xl: "20px" },
      boxShadow: {
        glow: "0 0 24px -4px rgb(var(--accent) / .45)",
        panel: "0 8px 32px -8px rgb(0 0 0 / .5)",
      },
    },
  },
};
