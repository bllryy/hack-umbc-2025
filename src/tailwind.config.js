
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {

        colors: {

        },

        keyframes: {
            "typewriter": {
                '0%': { width: '0%' },
                '100%': { width: '31%' },
            },
            "blink": {
                '0%, 100%': { 'border-right-color': 'transparent' },
                '50%': { 'border-right-color': 'black' },
            },
                "float": {
                    "0%": {
                        transform: "translateY(-1px)",
                },
                "50%": {
                    transform: "translateY(1px)",
                },
                "100%": {
                    tranform: "translateY(-1px)",
                },
            },
            "fadeIn": {
                "0%": {
                    opacity: "0",
                },
                "100%": {
                    opacity: "1",
                },
            },
        },
        animation: {
            "float": "float 1s ease-in-out",
            "fadeIn": "fadeIn 1s ease-in forwards",
            "typewriter": 'typewriter 5s steps(45, end)',
            "caret": 'typewriter 3s steps(30, end) forwards, blink 1s step-end infinite',
        },
    },
},

  plugins: [
  
    
  ],
};

