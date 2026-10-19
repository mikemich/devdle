// Sanity-checks the puzzle pool: `node scripts/check-puzzles.js`
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { window: {} };
for (const file of ["languages.js", "puzzles.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8"), ctx);
}
const { LANGUAGES, PUZZLES, PARADIGMS } = ctx.window;

const problems = [];
const names = new Set(LANGUAGES.map((l) => l.name));
const aliases = new Map();

for (const lang of LANGUAGES) {
  for (const key of [lang.name.toLowerCase(), ...lang.aliases]) {
    if (aliases.has(key)) problems.push(`"${key}" is used by both ${aliases.get(key)} and ${lang.name}`);
    aliases.set(key, lang.name);
  }
  for (const p of lang.paradigms) if (!PARADIGMS[p]) problems.push(`${lang.name}: unknown paradigm ${p}`);
}

PUZZLES.forEach((p, i) => {
  const tag = `puzzle ${i} (${p.answer})`;
  if (!names.has(p.answer)) problems.push(`${tag}: answer is not in LANGUAGES`);
  if (p.lines.length !== 5) problems.push(`${tag}: has ${p.lines.length} lines, expected 5`);
  const order = [...p.reveal].sort().join();
  if (order !== "0,1,2,3,4") problems.push(`${tag}: reveal must be a permutation of 0-4`);
  p.lines.forEach((line, j) => {
    if (!line.trim()) problems.push(`${tag}: line ${j + 1} is blank`);
    if (line.length > 52) problems.push(`${tag}: line ${j + 1} is ${line.length} chars (max 52)`);
  });
});

const covered = new Set(PUZZLES.map((p) => p.answer));
console.log(`${PUZZLES.length} puzzles, ${covered.size}/${LANGUAGES.length} languages used as answers`);
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log("All good.");
