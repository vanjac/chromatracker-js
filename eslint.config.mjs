import {defineConfig} from 'eslint/config'
import js from '@eslint/js'

export default defineConfig([{
    plugins: {js},
    extends: ["js/recommended"],
    languageOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
    },
    rules: {
        "no-var": "error",
        "curly": "error",
        "strict": ["error", "global"],
        "no-restricted-globals": ["error", "length"],
        // Deprecated stylistic rules (TODO)
        "semi": ["error", "never", {"beforeStatementContinuationChars": "always"}],
        // TypeScript handles these:
        "no-undef": "off",
        "no-unused-vars": "off",
        // annoying:
        "no-empty": "off",
        "no-constant-condition": "off",
    },
}])
