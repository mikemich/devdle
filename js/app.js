(() => {
  "use strict";

  const LAUNCH = Date.UTC(2026, 9, 19); // Devdle #1
  const DAY_MS = 86400000;
  const MAX_GUESSES = 6;
  const LINES = 5;
  const STORE = "devdle:v1:";

  const PARADIGM_SHORT = { P: "Proc", O: "OOP", F: "Func", C: "Conc", L: "Logic", D: "Decl", A: "Array" };
  const RUNS_SHORT = { "Bytecode VM": "VM" };
  const BLOCKS_SHORT = { Indentation: "Indent", Parentheses: "Parens" };
  const EXT = {
    Bash: "sh", C: "c", "C#": "cs", "C++": "cpp", Clojure: "clj", COBOL: "cbl", CoffeeScript: "coffee",
    "Common Lisp": "lisp", Crystal: "cr", D: "d", Dart: "dart", Elixir: "ex", Elm: "elm", Erlang: "erl",
    "F#": "fs", Fortran: "f90", Go: "go", Groovy: "groovy", Haskell: "hs", Java: "java", JavaScript: "js",
    Julia: "jl", Kotlin: "kt", Lua: "lua", MATLAB: "m", Nim: "nim", "Objective-C": "m", OCaml: "ml",
    Pascal: "pas", Perl: "pl", PHP: "php", PowerShell: "ps1", Prolog: "pl", Python: "py", R: "r",
    Racket: "rkt", Ruby: "rb", Rust: "rs", Scala: "scala", Scheme: "scm", SQL: "sql", Swift: "swift",
    TypeScript: "ts", "Visual Basic": "vb", Zig: "zig",
  };
  const EMOJI = { hit: "🟩", near: "🟨", miss: "⬛" };

  const $ = (id) => document.getElementById(id);
  const byName = new Map(LANGUAGES.map((l) => [l.name, l]));

  // ---------- storage (best effort; the game works without it) ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(STORE + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(STORE + key, JSON.stringify(value));
    } catch {
      /* private mode, quota, etc. */
    }
  }

  // ---------- which puzzle ----------

  function dayOf(date) {
    const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((local - LAUNCH) / DAY_MS);
  }

  const today = Math.max(0, dayOf(new Date()));
  // Archive puzzles live at #day-N (a hash, so it also works where query strings are stripped).
  const dayHash = location.hash.match(/^#day-(\d+)$/);
  const requested = dayHash ? parseInt(dayHash[1], 10) - 1 : null;
  window.addEventListener("hashchange", () => location.reload());
  const archive = requested !== null && requested >= 0 && requested < today;
  const day = archive ? requested : today;
  const puzzle = PUZZLES[day % PUZZLES.length];
  const answer = byName.get(puzzle.answer);
  if (!answer) throw new Error(`Puzzle answer "${puzzle.answer}" is not in LANGUAGES`);

  const state = load(`day:${day}`, null) || { guesses: [], status: "playing" };
  state.guesses = state.guesses.filter((n) => byName.has(n));

  const stats = Object.assign(
    { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: null, lastPlayedDay: null, dist: [0, 0, 0, 0, 0, 0] },
    load("stats", {})
  );

  // ---------- scoring ----------

  function score(guess) {
    const a = answer;
    const shared = guess.paradigms.filter((p) => a.paradigms.includes(p)).length;
    const sameParadigms = shared === a.paradigms.length && shared === guess.paradigms.length;
    const yearGap = Math.abs(guess.year - a.year);
    return [
      {
        label: String(guess.year),
        arrow: guess.year === a.year ? "" : a.year > guess.year ? "↑" : "↓",
        status: yearGap === 0 ? "hit" : yearGap <= 5 ? "near" : "miss",
        title: guess.year === a.year ? "Same year" : a.year > guess.year ? "The answer is newer" : "The answer is older",
      },
      { label: guess.typing, status: guess.typing === a.typing ? "hit" : "miss" },
      {
        parts: guess.paradigms.map((p) => PARADIGM_SHORT[p]),
        title: guess.paradigms.map((p) => PARADIGMS[p]).join(", "),
        status: sameParadigms ? "hit" : shared ? "near" : "miss",
      },
      { label: RUNS_SHORT[guess.runs] || guess.runs, title: guess.runs, status: guess.runs === a.runs ? "hit" : "miss" },
      { label: BLOCKS_SHORT[guess.blocks] || guess.blocks, title: guess.blocks, status: guess.blocks === a.blocks ? "hit" : "miss" },
    ];
  }

  // ---------- rendering ----------

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // Words and numbers become blank bars of the same width; everything else stays.
  function maskedLine(line) {
    return line
      .split(/([A-Za-z0-9_]+)/)
      .map((part, i) => (i % 2 ? `<span class="mask">${"x".repeat(part.length)}</span>` : escapeHtml(part)))
      .join("");
  }

  function revealedLine(line) {
    return line
      .split(/("(?:\\.|[^"\\])*"|\b\d+(?:\.\d+)?\b)/)
      .map((part, i) => {
        if (!(i % 2)) return escapeHtml(part);
        const cls = part.startsWith('"') ? "tok-str" : "tok-num";
        return `<span class="${cls}">${escapeHtml(part)}</span>`;
      })
      .join("");
  }

  function revealedSet() {
    if (state.status !== "playing") return new Set(puzzle.reveal);
    return new Set(puzzle.reveal.slice(0, Math.min(state.guesses.length, LINES)));
  }

  let lastRevealed = null;

  function renderCode() {
    const shown = revealedSet();
    $("code").innerHTML = puzzle.lines
      .map((line, i) => {
        const fresh = lastRevealed && shown.has(i) && !lastRevealed.has(i);
        const body = shown.has(i) ? revealedLine(line) : maskedLine(line);
        return `<li class="${fresh ? "just-revealed" : ""}">${body || " "}</li>`;
      })
      .join("");
    lastRevealed = shown;
    $("filename").textContent = state.status === "playing" ? "puzzle.???" : `puzzle.${EXT[answer.name] || "txt"}`;
  }

  function renderStatus() {
    const n = state.guesses.length;
    const pips = Array.from({ length: MAX_GUESSES }, (_, i) => {
      const cls = i < n ? (state.status === "won" && i === n - 1 ? "won" : "used") : "";
      return `<i class="${cls}"></i>`;
    }).join("");
    let text;
    if (state.status === "playing") {
      const unmasked = Math.min(n, LINES);
      text = `<span>Guess <strong>${n + 1}</strong> of ${MAX_GUESSES} · ${unmasked}/${LINES} lines unmasked</span>`;
    } else {
      text = `<span>${state.status === "won" ? "Solved" : "Out of guesses"} · ${n}/${MAX_GUESSES}</span>`;
    }
    $("status").innerHTML = `${text}<span class="pips" aria-hidden="true">${pips}</span>`;
  }

  function tileHtml(t) {
    const body = t.parts ? t.parts.map((p) => `<span>${p}</span>`).join("") : `<span>${escapeHtml(t.label)}</span>`;
    const arrow = t.arrow ? `<span class="arrow">${t.arrow}</span>` : "";
    return `<div class="tile ${t.status}" title="${escapeHtml(t.title || t.label || "")}">${body}${arrow}</div>`;
  }

  function renderBoard(animateNewest) {
    $("board-head").hidden = state.guesses.length === 0;
    $("rows").innerHTML = state.guesses
      .map((name, i) => {
        const lang = byName.get(name);
        const correct = name === answer.name;
        const cls = ["row", correct ? "correct" : "", animateNewest && i === state.guesses.length - 1 ? "new" : ""].join(" ");
        return `<div class="${cls}"><div class="row-name">${escapeHtml(name)}</div>${score(lang).map(tileHtml).join("")}</div>`;
      })
      .reverse()
      .join("");
  }

  function renderResult() {
    const over = state.status !== "playing";
    $("guess-form").hidden = over;
    $("result").hidden = !over;
    if (!over) return;
    const won = state.status === "won";
    const heading = won
      ? `Solved in ${state.guesses.length}/${MAX_GUESSES}${state.guesses.length === 1 ? " — from the silhouette alone!" : ""}`
      : "Out of guesses";
    const prev = day > 0 ? `<a class="btn-secondary" href="#day-${day}">← #${day}</a>` : "";
    const back = archive ? `<a class="btn-secondary" href="#today">Today</a>` : "";
    $("result").innerHTML = `
      <div>
        <h2>${heading}</h2>
        <p>It was <strong class="answer">${escapeHtml(answer.name)}</strong> (${answer.year}).</p>
      </div>
      <div class="result-actions">
        ${prev}${back}
        <button class="btn-secondary" data-action="stats">Stats</button>
        <button class="btn-primary" data-action="share">Share</button>
      </div>`;
  }

  function render(animateNewest = false) {
    renderCode();
    renderStatus();
    renderBoard(animateNewest);
    renderResult();
  }

  // ---------- suggestions / input ----------

  const input = $("guess-input");
  const list = $("suggestions");
  let options = [];
  let active = -1;

  function findMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const guessed = new Set(state.guesses);
    const found = [];
    for (const lang of LANGUAGES) {
      if (guessed.has(lang.name)) continue;
      const name = lang.name.toLowerCase();
      const alias = lang.aliases.find((a) => a.startsWith(q));
      let rank = -1;
      if (name === q || lang.aliases.includes(q)) rank = 0;
      else if (name.startsWith(q)) rank = 1;
      else if (alias) rank = 2;
      else if (name.includes(q)) rank = 3;
      if (rank >= 0) found.push({ lang, rank, alias: rank === 2 ? alias : null });
    }
    return found.sort((a, b) => a.rank - b.rank || a.lang.name.localeCompare(b.lang.name)).slice(0, 8);
  }

  function renderSuggestions() {
    if (!options.length) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    list.innerHTML = options
      .map(
        (o, i) =>
          `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === active}">` +
          `<span>${escapeHtml(o.lang.name)}</span>${o.alias ? `<span class="alias">${escapeHtml(o.alias)}</span>` : ""}</li>`
      )
      .join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", `opt-${active}`);
      list.children[active].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function closeSuggestions() {
    options = [];
    active = -1;
    renderSuggestions();
  }

  function resolveGuess() {
    if (active >= 0 && options[active]) return options[active].lang;
    const q = input.value.trim().toLowerCase();
    const exact = LANGUAGES.find((l) => l.name.toLowerCase() === q || l.aliases.includes(q));
    if (exact) return exact;
    const matches = findMatches(q);
    return matches.length === 1 ? matches[0].lang : null;
  }

  function reject(message) {
    const combo = input.parentElement;
    combo.classList.remove("shake");
    void combo.offsetWidth; // restart the animation
    combo.classList.add("shake");
    toast(message);
  }

  input.addEventListener("input", () => {
    options = findMatches(input.value);
    active = options.length ? 0 : -1;
    renderSuggestions();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      active = (active + step + options.length) % options.length;
      renderSuggestions();
    } else if (e.key === "Escape") {
      closeSuggestions();
    }
  });

  input.addEventListener("blur", () => setTimeout(closeSuggestions, 120));

  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    active = Number(li.dataset.i);
    $("guess-form").requestSubmit();
  });

  $("guess-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.status !== "playing") return;
    if (!input.value.trim()) return reject("Type a language first");
    const lang = resolveGuess();
    if (!lang) return reject("Not in the language list");
    if (state.guesses.includes(lang.name)) return reject(`Already tried ${lang.name}`);
    input.value = "";
    closeSuggestions();
    guess(lang);
  });

  // ---------- game flow ----------

  function guess(lang) {
    state.guesses.push(lang.name);
    if (lang.name === answer.name) state.status = "won";
    else if (state.guesses.length >= MAX_GUESSES) state.status = "lost";
    save(`day:${day}`, state);

    if (state.status !== "playing") {
      if (!archive) recordStats();
      render(true);
      setTimeout(() => openStats(), 1400);
    } else {
      render(true);
      if (state.guesses.length <= LINES) toast(`Not ${lang.name} — line unmasked`);
      input.focus();
    }
  }

  function recordStats() {
    if (stats.lastPlayedDay === day) return;
    stats.played += 1;
    stats.lastPlayedDay = day;
    if (state.status === "won") {
      stats.wins += 1;
      stats.dist[state.guesses.length - 1] += 1;
      stats.streak = stats.lastWinDay === day - 1 ? stats.streak + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      stats.lastWinDay = day;
    } else {
      stats.streak = 0;
    }
    save("stats", stats);
  }

  const currentStreak = () => (stats.lastWinDay !== null && stats.lastWinDay >= today - 1 ? stats.streak : 0);

  // ---------- share ----------

  function shareText() {
    const won = state.status === "won";
    const rows = state.guesses.map((name) => {
      if (name === answer.name) return EMOJI.hit.repeat(5);
      return score(byName.get(name)).map((t) => EMOJI[t.status]).join("");
    });
    const header = `Devdle #${day + 1} ${won ? state.guesses.length : "X"}/${MAX_GUESSES}`;
    // DEVDLE_URL lets a host (e.g. a published build) pin the link people share.
    const link = window.DEVDLE_URL || (location.protocol.startsWith("http") ? location.origin + location.pathname : "");
    return `${header}\n${rows.join("\n")}${link ? `\n${link}` : ""}`;
  }

  async function share() {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast("Results copied to clipboard");
  }

  // ---------- stats modal ----------

  function msToMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }

  const fmtCountdown = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");
  };

  function renderStats() {
    const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    $("stat-grid").innerHTML = [
      [stats.played, "Played"],
      [winPct, "Win %"],
      [currentStreak(), "Streak"],
      [stats.maxStreak, "Best"],
    ]
      .map(([num, lbl]) => `<div><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`)
      .join("");

    const peak = Math.max(1, ...stats.dist);
    const todayWin = !archive && state.status === "won" ? state.guesses.length - 1 : -1;
    $("dist").innerHTML = stats.dist
      .map(
        (count, i) =>
          `<div class="dist-row"><span>${i + 1}</span>` +
          `<span class="dist-bar ${i === todayWin ? "today" : ""}" style="width:${Math.max(8, (count / peak) * 100)}%">${count}</span></div>`
      )
      .join("");

    const shareBtn = state.status !== "playing" ? `<button class="btn-primary" data-action="share">Share</button>` : "";
    $("stats-foot").innerHTML =
      `<div class="countdown"><div class="lbl">Next Devdle in</div><div class="num" id="countdown">${fmtCountdown(msToMidnight())}</div></div>` +
      shareBtn;
  }

  function openStats() {
    renderStats();
    if (!$("stats-modal").open) $("stats-modal").showModal();
  }

  setInterval(() => {
    const el = $("countdown");
    if (el) el.textContent = fmtCountdown(msToMidnight());
  }, 1000);

  // ---------- toast ----------

  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ---------- theme ----------

  const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const savedTheme = load("theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  $("btn-theme").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || (prefersDark() ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    save("theme", next);
  });

  // ---------- wiring ----------

  document.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "share") share();
    if (action === "stats") openStats();
  });

  for (const modal of document.querySelectorAll("dialog")) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.close(); // backdrop click
    });
  }

  $("btn-help").addEventListener("click", () => $("help-modal").showModal());
  $("btn-stats").addEventListener("click", openStats);

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      input.focus();
    }
  });

  $("day-tag").textContent = `#${day + 1}`;
  if (archive) {
    const banner = $("archive-banner");
    banner.innerHTML = `<span>Archive puzzle #${day + 1} · doesn't count toward stats</span><a href="#today">Back to today →</a>`;
    banner.hidden = false;
  }

  render();

  if (!load("seenHelp", false)) {
    save("seenHelp", true);
    $("help-modal").showModal();
  } else if (state.status === "playing") {
    input.focus();
  }
})();
