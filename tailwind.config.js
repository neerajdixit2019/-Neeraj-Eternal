/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        sacred: "0 24px 70px rgba(79, 70, 106, 0.16)",
        "sacred-soft": "0 16px 42px rgba(79, 70, 106, 0.12)"
      }
    }
  },
  plugins: []
};
