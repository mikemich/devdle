// Bundles the game into one self-contained HTML fragment (CSS and JS inlined),
// the shape a Claude artifact expects: no doctype/html/head/body of its own.
//
//   node scripts/build-single-file.js <out.html> [share-url]
//
// share-url, if given, becomes the link at the bottom of copied results.
const fs = require("fs");
const path = require("path");

const [out, shareUrl] = process.argv.slice(2);
if (!out) {
  console.error("usage: node scripts/build-single-file.js <out.html> [share-url]");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html");

const between = (open, close) => {
  const start = html.indexOf(open);
  const end = html.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error(`index.html is missing ${open}…${close}`);
  return html.slice(start + open.length, end);
};

const inlineScript = (src) => {
  const code = read(src);
  if (code.includes("</script")) throw new Error(`${src} contains </script and can't be inlined`);
  return `<script>\n${code}</script>`;
};

let head = between("<head>", "</head>")
  .replace(/\s*<meta charset[^>]*>/, "")
  .replace(/\s*<meta name="viewport"[^>]*>/, "")
  .replace(/(<title>[^<]*<\/title>)/, '$1\n  <meta name="claude:viewport-fit-sides" content="cover">')
  .replace(/<link rel="stylesheet" href="css\/styles\.css">/, () => `<style>\n${read("css/styles.css")}</style>`);

let body = between("<body>", "</body>").replace(/<script src="([^"]+)"><\/script>/g, (_, src) => inlineScript(src));

if (shareUrl) {
  body = body.replace(inlineScript("js/app.js"), () => `<script>window.DEVDLE_URL = ${JSON.stringify(shareUrl)};</script>\n  ${inlineScript("js/app.js")}`);
}

fs.writeFileSync(out, `${head.trim()}\n\n${body.trim()}\n`);
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
