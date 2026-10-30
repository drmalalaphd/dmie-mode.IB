/* ------------------------------------------------------------------
   DEMO ONLY: these logins sit in the browser, so anyone can read them.
   For a real site, check logins on a server and never ship passwords here.
------------------------------------------------------------------- */
const USERS = [
  { user: "team@example.com",   pass: "team123",   role: "team",   name: "Team member" },
  { user: "client@example.com", pass: "client123", role: "client", name: "Client" },
  { user: "demo",               pass: "demo123",   role: "demo",   name: "Guest", minutes: 10 } // temp access
];

const SESSION_KEY = "session";
let content = null;
let timerId = null;

const $ = (id) => document.getElementById(id);

/* ---------- storage helpers ---------- */
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function setSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

/* ---------- views ---------- */
function show(name) {
  ["public", "login", "member"].forEach((v) => {
    $("view-" + v).hidden = v !== name;
  });
}

function showMessage(text) {
  const el = $("msg");
  el.textContent = text || "";
  el.hidden = !text;
}

/* ---------- text from JSON ---------- */
function setPublicText() {
  const p = content.public;
  $("brand").textContent = content.site.name;
  document.title = content.site.name;
  $("hero-title").textContent = p.hero_title;
  $("hero-text").textContent = p.hero_text;
  $("hero-cta").textContent = p.hero_cta;
  $("login-title").textContent = p.login_title;
  $("login-text").textContent = p.login_text;
  $("email-label").textContent = p.email_label;
  $("password-label").textContent = p.password_label;
  $("submit").textContent = p.submit;
  $("cancel").textContent = p.cancel;
  $("footer").textContent = p.footer;
}

function renderLoggedOut() {
  stopTimer();
  document.body.removeAttribute("data-role");
  setPublicText();
  $("badge").hidden = true;
  $("nav-btn").textContent = content.public.nav_login;
  $("nav-btn").onclick = () => { showMessage(""); show("login"); $("user").focus(); };
  show("public");
}

function renderLoggedIn(session) {
  const r = content.roles[session.role];
  document.body.dataset.role = session.role;

  $("badge").textContent = r.badge;
  $("badge").hidden = false;
  $("nav-btn").textContent = r.nav_logout;
  $("nav-btn").onclick = logout;

  $("welcome-title").textContent = r.welcome_title.replace("{name}", session.name);
  $("welcome-text").textContent = r.welcome_text;
  $("footer").textContent = r.footer;

  $("cards").innerHTML = "";
  r.cards.forEach((c) => {
    const card = document.createElement("article");
    card.className = "card";
    const h = document.createElement("h2");
    h.textContent = c.title;
    const p = document.createElement("p");
    p.textContent = c.text;
    card.append(h, p);
    $("cards").append(card);
  });

  if (session.role === "demo") startTimer(session, r.expiry_notice);
  else $("timer").hidden = true;

  show("member");
}

/* ---------- demo (temporary) access ---------- */
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return m + ":" + s;
}

function startTimer(session, template) {
  const el = $("timer");
  el.hidden = false;
  const tick = () => {
    const left = session.expires - Date.now();
    if (left <= 0) { logout(content.public.error_expired); return; }
    el.textContent = template.replace("{time}", formatTime(left));
  };
  stopTimer();
  tick();
  timerId = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

/* ---------- login / logout ---------- */
function login(e) {
  e.preventDefault();
  const user = $("user").value.trim().toLowerCase();
  const pass = $("pass").value;
  const found = USERS.find((u) => u.user.toLowerCase() === user && u.pass === pass);

  if (!found) { showMessage(content.public.error_invalid); return; }

  const session = { role: found.role, name: found.name };
  if (found.minutes) session.expires = Date.now() + found.minutes * 60 * 1000;

  setSession(session);
  $("login-form").reset();
  showMessage("");
  renderLoggedIn(session);
}

function logout(message) {
  clearSession();
  renderLoggedOut();
  if (typeof message === "string" && message) {
    showMessage(message);
    show("login");
  }
}

/* ---------- start ---------- */
async function init() {
  try {
    const res = await fetch("content.json");
    if (!res.ok) throw new Error(res.status);
    content = await res.json();
  } catch (err) {
    document.querySelector("main").textContent =
      "The text file could not load. Open this page through a web server, not by double-clicking the file.";
    return;
  }

  $("login-form").addEventListener("submit", login);
  $("hero-cta").addEventListener("click", () => { showMessage(""); show("login"); $("user").focus(); });
  $("cancel").addEventListener("click", () => show("public"));

  const session = getSession();
  if (session && session.expires && session.expires <= Date.now()) {
    logout(content.public.error_expired);
  } else if (session && content.roles[session.role]) {
    renderLoggedIn(session);
  } else {
    renderLoggedOut();
  }
}

init();
