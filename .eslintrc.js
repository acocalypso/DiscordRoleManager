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
  },
};
