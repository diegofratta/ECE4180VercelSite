/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
      },
      colors: {
        // Georgia Tech Official Colors
        gt: {
          gold: "#B3A369",
          "gold-light": "#C4B67D",
          "gold-dark": "#8B7D4F",
          navy: "#003057",
          "navy-light": "#1A4A73",
          "navy-dark": "#002142",
        },
        // Primary palette (GT-inspired)
        primary: {
          50: "#f7f6f2",
          100: "#ebe8de",
          200: "#d9d4c4",
          300: "#c4bba3",
          400: "#B3A369", // GT Gold
          500: "#9d8d54",
          600: "#8B7D4F",
          700: "#6f6340",
          800: "#5a5035",
          900: "#48412c",
          950: "#282418",
        },
        // Secondary palette (Navy-inspired)
        secondary: {
          50: "#e8f0f7",
          100: "#ccdce9",
          200: "#99b9d4",
          300: "#6696bf",
          400: "#3373aa",
          500: "#003057", // GT Navy
          600: "#002a4d",
          700: "#002142",
          800: "#001a35",
          900: "#001329",
          950: "#000a17",
        },
        // Accent colors
        accent: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6",
        },
        // Surface colors for cards/backgrounds
        surface: {
          light: "#FFFFFF",
          "light-alt": "#F8F9FA",
          "light-muted": "#F1F3F4",
          dark: "#0F172A",
          "dark-alt": "#1E293B",
          "dark-muted": "#334155",
        },
      },
      boxShadow: {
        "glow-gold": "0 0 20px rgba(179, 163, 105, 0.3)",
        "glow-navy": "0 0 20px rgba(0, 48, 87, 0.3)",
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        "card-hover":
          "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        "inner-glow": "inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "slide-down": "slideDown 0.3s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        shake: "shake 0.5s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(179, 163, 105, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(179, 163, 105, 0.6)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
      },
      transitionTimingFunction: {
        "bounce-out": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
