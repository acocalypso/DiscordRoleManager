module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'linebreak-style': 0,
    'no-console': 0,
    'new-cap': 0,
    'no-underscore-dangle': 0,
    'func-names': 0,
    'prefer-destructuring': 0,
    'prefer-template': 0,
    'no-template-curly-in-string': 0,
    'max-len': 0,
    'no-await-in-loop': 0,
    'no-shadow': 0,
    camelcase: 0,
    'no-loop-func': 0,
    'no-continue': 0,
    'no-promise-executor-return': 0,
    'no-param-reassign': 0,
    'no-else-return': 0,
    'no-async-promise-executor': 0,
    'brace-style': 0,
  },
};
