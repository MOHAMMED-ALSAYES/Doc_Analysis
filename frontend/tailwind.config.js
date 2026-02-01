/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cyan: {
          500: "#00BCD4",
          400: "#00E5FF"
        },
        base: {
          900: "#0A0A0A",
          800: "#0F1112"
        },
        text: {
          primary: "#E0F7FA",
          secondary: "#9AA6A6"
        }
      },
      boxShadow: {
        cyan: "0 0 10px rgba(0,229,255,0.25)",
      },
      borderRadius: {
        xl: "12px"
      }
    }
  },
  darkMode: 'class',
  plugins: []
}

