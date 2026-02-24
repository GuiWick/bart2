/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        near: {
          green: "#00EC97",
          dark: "#0D0D0D",
          "dark-2": "#1a1a1a",
          "green-hover": "#00d488",
          "green-muted": "#e6fdf5",
          "green-text": "#007a50",
        },
      },
    },
  },
  plugins: [],
};
