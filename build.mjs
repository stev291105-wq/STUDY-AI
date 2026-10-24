// Construye las dos salidas desde el mismo código fuente:
//   web/       → sitio estático para GitHub Pages (librerías locales en vendor/)
//   artifact/  → página única para la versión dentro de Claude (librerías por CDN)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const B = new URL(".", import.meta.url).pathname;
const WEB = process.argv[2] || B + "dist/web";
const ART = process.argv[3] || B + "dist/artifact";
const read = (p) => readFileSync(B + p, "utf8");
execSync(`npx tailwindcss -c ${B}tailwind.config.cjs -i ${B}src/input.css -o ${B}out.css --minify`, { cwd: B, stdio: "inherit" });
const css = readFileSync(B + "out.css", "utf8");
const js = "(() => {\n\"use strict\";\n" + ["core.js", "providers.js", "ui.js"].map((f) => read("src/" + f)).join("\n") + "\n})();";
writeFileSync(B + "app.check.js", js);
execSync(`node --check ${B}app.check.js`);
const ver = new Date().toISOString().slice(0, 10).replace(/-/g, "");

mkdirSync(WEB + "/assets", { recursive: true });
writeFileSync(WEB + "/assets/app.css", css);
writeFileSync(WEB + "/assets/app.js", js);
writeFileSync(WEB + "/index.html", read("src/web-head.html").replaceAll("__VER__", ver));

mkdirSync(ART, { recursive: true });
writeFileSync(ART + "/studymaster.html", read("src/page.html").replace("/*__CSS__*/", () => css).replace("/*__JS__*/", () => js));
console.log("OK", ver, (js.length / 1024).toFixed(0) + " KB js", (css.length / 1024).toFixed(0) + " KB css");
