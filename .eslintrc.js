module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": [
        "prettier",
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended"
    ],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "plugins": [
        "prettier",
        "@typescript-eslint"
    ],
    "rules": {
        "prettier/prettier": "error",
    }
};