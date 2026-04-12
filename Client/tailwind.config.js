/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effcf7",
          100: "#d7f6ea",
          500: "#00a77f",
          700: "#007659",
          900: "#054838",
        },
        sunrise: {
          200: "#ffe4b8",
          500: "#ff9f43",
          700: "#c96a11",
        },
      },
      boxShadow: {
        glow: "0 18px 45px -25px rgba(0, 167, 127, 0.45)",
      },
      fontFamily: {
        display: ["Sora", "ui-sans-serif", "system-ui"],
        body: ["Manrope", "ui-sans-serif", "system-ui"],
      },
      backgroundImage: {
        "hero-radial": "radial-gradient(circle at top right, rgba(255, 159, 67, 0.25), transparent 52%), radial-gradient(circle at bottom left, rgba(0, 167, 127, 0.18), transparent 42%)",
      },
    },
  },
  plugins: [],
};
