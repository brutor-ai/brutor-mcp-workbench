/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Existing sky colors from Tailwind
                'sky': {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                // Primary color palette based on #1BB5E8
                primary: {
                    50: '#e8f8fd',
                    100: '#d1f1fb',
                    200: '#a3e3f7',
                    300: '#75d5f3',
                    400: '#47c7ef',
                    DEFAULT: '#1BB5E8', // Main brand color
                    500: '#1BB5E8',
                    600: '#1691ba',
                    700: '#116d8b',
                    800: '#0c485d',
                    900: '#06242e',
                },
                // Alternative naming for backward compatibility
                'sky-border': '#1BB5E8',
            },
            // Custom animation for logo
            animation: {
                'float': 'float 3s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '33%': { transform: 'translateY(-1px) rotate(1deg)' },
                    '66%': { transform: 'translateY(1px) rotate(-1deg)' },
                }
            }
        },
    },
    plugins: [],
}