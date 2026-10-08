import js from "@eslint/js";
import globals from "globals";

export default [
    { ignores: ["node_modules/", "test-results/", "playwright-report/"] },
    js.configs.recommended,
    {
        // App code: classic browser scripts sharing the global scope
        files: ["app.js", "theme-init.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: { ...globals.browser, lucide: "readonly", Chart: "readonly" }
        }
    },
    {
        files: ["**/*.mjs", "tests/**/*.js", "playwright.config.js"],
        languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } }
    },
    {
        // page.evaluate() callbacks run in the browser and may read the app's globals
        files: ["tests/**/*.js"],
        languageOptions: {
            globals: { ...globals.browser, Chart: "readonly", weatherData: "readonly", currentHourIdx: "readonly", fetchWeatherData: "readonly" }
        }
    },
    {
        rules: {
            "eqeqeq": "error",
            "no-unused-vars": ["error", { caughtErrors: "none" }],
            "prefer-const": "error"
        }
    }
];
