// @ts-nocheck

import {defineConfig, globalIgnores} from 'eslint/config'
import js from '@eslint/js'
import css from '@eslint/css'
import globals from 'globals'
import compat from 'eslint-plugin-compat'

export default defineConfig([
    globalIgnores(['build/']),
    {
        files: ["**/*.js", "**/*.mjs"],
        plugins: {js, compat},
        extends: ["js/recommended"],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: globals.browser,
        },
        rules: {
            "strict": ["error", "global"],
            "no-var": "error",
            "curly": "error",
            "no-undefined": "error",
            "no-sequences": "error",
            "prefer-rest-params": "error",
            "object-shorthand": ["warn", "always", {"avoidExplicitReturnArrows": true}],
            "prefer-destructuring": ["warn", {"object": true}],
            "prefer-object-spread": "warn",
            "no-lonely-if": "warn",
            "require-await": "warn",
            "class-methods-use-this": "warn",
            "no-restricted-globals": ["error", "length", "Reflect"],
            "no-restricted-properties": [
                "error",
                {"property": "prototype"},
                {"object": "Object", "property": "create"},
                {"object": "Object", "property": "defineProperty"},
                {"object": "Object", "property": "defineProperties"},
                {"object": "Object", "property": "setPrototypeOf"},
            ],
            "no-restricted-syntax": [
                "error",
                // no strict equality
                "BinaryExpression[operator='===']",
                "BinaryExpression[operator='!==']",
                // no (non-arrow) function expressions
                ":not(Property):not(MethodDefinition) > FunctionExpression[generator=false]",
                // no 'this' outside clsss methods
                "FunctionDeclaration ThisExpression",
                "Property FunctionExpression ThisExpression",
                // no 'extends'
                "ClassDeclaration[superClass]",
                "ClassExpression[superClass]",
                // no getters/setters
                "Property[kind='get']",
                "Property[kind='set']",
                "MethodDefinition[kind='get']",
                "MethodDefinition[kind='set']",
                // no 'new.target'
                "MetaProperty Identifier[name='new']",
            ],
            // Deprecated rules (TODO)
            "semi": ["error", "never", {"beforeStatementContinuationChars": "always"}],
            // TypeScript handles this:
            "no-unused-vars": "off",
            // Plugins:
            "compat/compat": "error",
        },
    },
    {
        files: ["src/Mustard.js"],
        languageOptions: {
            sourceType: "script",
        }
    },
    {
        files: ["**/*.css"],
        plugins: {css},
        language: "css/css",
        rules: {
            "css/no-invalid-properties": ["error", {"allowUnknownVariables": true}],
            "css/no-invalid-at-rules": "error",
            "css/use-baseline": ["warn", {"available": 2022}],
        },
    },
])
