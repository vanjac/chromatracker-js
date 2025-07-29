import {defineConfig} from 'eslint/config'
import js from '@eslint/js'

export default defineConfig([
    {
        plugins: {js},
        extends: ["js/recommended"],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
        },
        rules: {
            "strict": ["error", "global"],
            "no-var": "error",
            "curly": "error",
            "no-undefined": "error",
            "object-shorthand": ["warn", "always", {"avoidExplicitReturnArrows": true}],
            "prefer-destructuring": ["warn", {"object": true}],
            "no-lonely-if": "warn",
            "require-await": "warn",
            "prefer-arrow-callback": "warn",
            "class-methods-use-this": "warn",
            "no-restricted-globals": ["error", "length"],
            "no-restricted-properties": ["error", {
                "property": "prototype",
            }],
            "no-restricted-syntax": [
                "error",
                // no 'extends'
                "ClassDeclaration[superClass]",
                "ClassExpression[superClass]",
                // no getters/setters
                "Property[kind='get']",
                "Property[kind='set']",
                "MethodDefinition[kind='get']",
                "MethodDefinition[kind='set']",
            ],
            // Deprecated rules (TODO)
            "semi": ["error", "never", {"beforeStatementContinuationChars": "always"}],
            // TypeScript handles these:
            "no-undef": "off",
            "no-unused-vars": "off",
        },
    },
    {
        files: ["src/Mustard.js"],
        languageOptions: {
            sourceType: "script",
        }
    },
])
