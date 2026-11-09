/* ------------------------------------------------------------------
   DEMO ONLY: these logins sit in the browser, so anyone can read them.
   For a real site, check logins on a server and never ship passwords here.
------------------------------------------------------------------- */
const USERS = [
  { user: "team@example.com",   pass: "team123",   role: "team",   name: { en: "Team member", fr: "Membre de l’équipe" } },
  { user: "client@example.com", pass: "client123", role: "client", name: { en: "Client",      fr: "Client" } },
  { user: "demo",               pass: "demo123",   role: "demo",   name: { en: "Guest",       fr: "Invité" }, minutes: 10 } // temp access
];

const LANGS = ["en", "fr"];
const DEFAULT_LANG = "en"; // English is the main language

const state = { lang: DEFAULT_LANG, session: null, view: "public", error: "" };
let all = null;     // whole content.json
let timerId = null;

/* ---------- tiny template engine: {{content.brandname}} ---------- */
const TAG = /\{\{\s*([\w.]+)\s*\}\}/g;
const get = (path, obj) => path.split(".").reduce((o, k) => o?.[k], obj);
const sub = (str, obj, fmt = (x) => x) => str.replace(TAG, (_, p) => fmt(get(p, obj) ?? ""));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Everything the page can use as {{...}}
function buildData() {
  const t = all[state.lang];
  const s = state.session;
  const role = s ? t.roles[s.role] : {};
  const name = s ? USERS.find((u) => u.role === s.role).name[state.lang] : "";
  const content = {
    ...t.public,
    ...role,
    brandname: t.brandname,
    error: state.error ? t.public[state.error] : "",
    timer: s?.expires ? role.expiry_notice.replace("{time}", formatTime(s.expires - Date.now())) : ""
  };
  if (content.welcome_title) content.welcome_title = content.welcome_title.replace("{name}", name);
  return {
    content,
    view: { [state.view]: true },
    pressed: Object.fromEntries(LANGS.map((l) => [l, String(l === state.lang)]))
  };
}

function render() {
  const d = buildData();
  const root = document.documentElement;
  root.lang = state.lang;
  document.body.dataset.role = state.session?.role ?? "";

  // 1. repeated blocks: <div data-repeat="content.cards">…{{title}}…</div>
  root.querySelectorAll("[data-repeat]").forEach((el) => {
    el._tpl ??= el.innerHTML;
    const html = (get(el.dataset.repeat, d) ?? []).map((item) => sub(el._tpl, item, esc)).join("");
    if (html !== el._last) { el.innerHTML = html; el._last = html; }
  });

  // 2. attributes {{…}} and show/hide with data-if="path"
  root.querySelectorAll("*").forEach((el) => {
    el._attrs ??= Object.fromEntries(
      [...el.attributes].filter((a) => a.value.includes("{{")).map((a) => [a.name, a.value])
    );
    for (const k in el._attrs) el.setAttribute(k, sub(el._attrs[k], d));
    if (el.dataset.if) el.hidden = !get(el.dataset.if, d);
  });

  // 3. text {{…}}
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    n._tpl ??= n.nodeValue;
    const v = sub(n._tpl, d);
    if (n.nodeValue !== v) n.nodeValue = v;
  }
}

/* ---------- storage ---------- */
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} }
};

/* ---------- login / logout / demo timer ---------- */
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function startSession(session) {
  state.session = session;
  state.view = "member";
  state.error = "";
  clearInterval(timerId);
  if (session.expires) timerId = setInterval(tick, 1000);
}

function tick() {
  if (state.session.expires <= Date.now()) logout("error_expired");
  else render();
}

function login(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const user = String(f.get("user")).trim().toLowerCase();
  const found = USERS.find((u) => u.user.toLowerCase() === user && u.pass === f.get("pass"));

  if (!found) { state.error = "error_invalid"; render(); return; }

  const session = { role: found.role };
  if (found.minutes) session.expires = Date.now() + found.minutes * 60 * 1000;
  store.set("session", session);
  e.target.reset();
  startSession(session);
  render();
}

// errorKey is optional, for example "error_expired"
function logout(errorKey) {
  store.del("session");
  clearInterval(timerId);
  state.session = null;
  state.error = errorKey || "";
  state.view = errorKey ? "login" : "public";
  render();
}

function openLogin() {
  state.view = "login";
  state.error = "";
  render();
  document.querySelector("[name=user]").focus();
}

function setLang(l) {
  if (!LANGS.includes(l)) return;
  state.lang = l;
  store.set("lang", l);
  render();
}

/* ---------- events: one listener each, using data-action ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "lang") setLang(el.dataset.lang);
  else if (a === "nav") state.session ? logout() : openLogin();
  else if (a === "start") openLogin();
  else if (a === "cancel") { state.view = "public"; state.error = ""; render(); }
});
document.addEventListener("submit", (e) => {
  if (e.target.dataset.action === "login") login(e);
});

/* ---------- start ---------- */
async function init() {
  try {
    const res = await fetch("content.json");
    if (!res.ok) throw new Error(res.status);
    all = await res.json();
  } catch (err) {
    document.querySelector("main").textContent =
      "The text file could not load. Open this page through a web server, not by double-clicking the file. / " +
      "Le fichier de textes n’a pas pu se charger. Ouvrez cette page via un serveur web, pas en double-cliquant sur le fichier.";
    document.body.classList.add("ready");
    return;
  }

  const saved = store.get("lang");
  state.lang = LANGS.includes(saved) ? saved : DEFAULT_LANG;

  const s = store.get("session");
  if (s && USERS.some((u) => u.role === s.role)) {
    if (s.expires && s.expires <= Date.now()) {
      store.del("session");
      state.error = "error_expired";
      state.view = "login";
    } else {
      startSession(s);
    }
  }

  render();
  document.body.classList.add("ready");
}

init();