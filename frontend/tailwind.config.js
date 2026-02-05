// /** @type {import('tailwindcss').Config} */
// export default {
//   content: [
//     "./index.html",
//     "./src/**/*.{js,ts,jsx,tsx}",
//   ],
//   theme: {
//     extend: {
//       colors: {
//         brand: {
//           black: "#050505",
//           glass: "rgba(255, 255, 255, 0.03)",
//           accent: "#6366f1",
//         }
//       },
//       animation: {
//         'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
//         'float': 'float 3s ease-in-out infinite',
//       },
//       keyframes: {
//         float: {
//           '0%, 100%': { transform: 'translateY(0)' },
//           '50%': { transform: 'translateY(-10px)' },
//         }
//       }
//     },
//   },
//   plugins: [],
// }


/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#050505",
          accent: "#6366f1",
        }
      }
    },
  },
  plugins: [],
}