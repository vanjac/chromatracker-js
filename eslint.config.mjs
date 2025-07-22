import {defineConfig} from 'eslint/config'
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([{
    plugins: {
        js,
        "@stylistic": stylistic,
    },
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
        "@stylistic/semi": ["error", "never", {"beforeStatementContinuationChars": "always"}],
        // TypeScript handles these:
        "no-undef": "off",
        "no-unused-vars": "off",
    },
}])
