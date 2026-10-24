module.exports = {
  content: ["./src/*.js", "./src/*.html"],
  safelist: [{ pattern: /^tone-/ }, { pattern: /^text-(lav|mint|butter|peach|sky|rose)$/ }],
  theme: { extend: {} },
  plugins: [],
};
