'use strict';

/** @type {import('eslint').ESLint.ConfigData} */
const config = {
    extends: ['eslint:recommended', 'plugin:import/recommended'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    globals: {Set: 'readonly', Map: 'readonly'},
    plugins: ['eslint-plugin-import'],
    rules: {
        strict: ['error', 'global'],
        // use typescript for this
        'no-unused-vars': 'off',
        'no-undef': 'off',
        'dot-notation': 'error',
        eqeqeq: 'error',
        'no-caller': 'error',
        'no-constant-condition': ['error', {checkLoops: false}],
        'no-eval': 'error',
        'no-extra-bind': 'error',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-return-await': 'error',
        'no-restricted-globals': [
            'error',
            {name: 'setTimeout'},
            {name: 'clearTimeout'},
            {name: 'setInterval'},
            {name: 'clearInterval'},
            {name: 'setImmediate'},
            {name: 'clearImmediate'},
        ],
        'import/no-default-export': 'error',
        'import/extensions': ['error', {js: 'always'}],
        'import/no-amd': 'error',
        'import/no-commonjs': 'error',
    },
};

module.exports = config;