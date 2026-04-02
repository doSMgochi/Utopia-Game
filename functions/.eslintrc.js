module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ["google"],
  parserOptions: {
    ecmaVersion: "latest"
  },
  rules: {
    "require-jsdoc": "off",
    "valid-jsdoc": "off"
  }
};
