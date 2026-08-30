/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./public/*.{html,js}"
  ],
  theme: {
    extend: {
      backdropBlur: {
        'glass': '65px',
      },
      colors: {
        'glass-bg': 'rgba(255, 255, 255, 0.78)',
        'glass-border': 'rgba(255, 255, 255, 0.45)',
      }
    },
  },
  plugins: [
    require("daisyui")
  ],
  daisyui: {
    themes: [
      {
        trento: {
          "primary": "#0056b3",
          "secondary": "#28a745",
          "accent": "#e67e22",
          "neutral": "#1e293b",
          "base-100": "#ffffff",
          "base-200": "#f8fafc",
          "base-300": "#e2e8f0",
          "info": "#0ea5e9",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
      "light",
      "corporate"
    ],
    defaultTheme: "trento",
    darkTheme: "trento",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: false,
  }
}
