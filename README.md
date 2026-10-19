# Devdle

A daily puzzle for programmers, like Wordle: guess the programming language from five obfuscated lines.

## How it plays

- Each day has one snippet: five lines of real code.
- At first every word and number is blanked out. Only the *shape* is visible: punctuation, operators, indentation.
- You get 6 guesses. Every wrong guess unmasks one more line and scores the guess against the answer on five traits:
  **Year**, **Typing**, **Paradigm**, **Runs** (compiled / VM / interpreted / transpiled) and **Blocks** (braces / indentation / keywords / parentheses).
  Green = match, yellow = partial (paradigms overlap, or the year is within 5), with ↑/↓ pointing toward the answer's year.
- Results copy to the clipboard as an emoji grid. Stats and streaks are kept in `localStorage`.

## Running it

It's plain HTML/CSS/JS with no build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

To play an earlier puzzle, add `#day-N` to the URL (archive games don't count toward stats).

## Project layout

```
index.html              page shell, help + stats dialogs
css/styles.css          styles (light/dark via prefers-color-scheme, toggle saved per browser)
js/languages.js         every guessable language and its traits
js/puzzles.js           the daily rotation
js/app.js               game logic: daily pick, masking, scoring, input, stats, share
scripts/check-puzzles.js  validates the data
```

## Adding puzzles

Day N (counted from launch on 2026-10-19, local time) plays `PUZZLES[N % PUZZLES.length]`.
**Only append** to `js/puzzles.js`; inserting or reordering changes puzzles that already ran.

Each puzzle needs exactly five non-blank lines (52 chars max so it fits on a phone) and a `reveal` order,
a permutation of `0–4` listing lines from least to most telling. The answer must match a `name` in
`js/languages.js`. Then run:

```bash
node scripts/check-puzzles.js
```
