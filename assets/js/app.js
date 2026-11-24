// Núcleo del sitio del Grupo 2: scroll suave, obturador entre páginas, revelados,
// portadas de capítulo con toma vertical, contadores y carga diferida de cada escena.
import { gsap, ScrollTrigger, SplitText, Lenis } from "../vendor/motion.js";
import { clamp } from "./util.js";

gsap.registerPlugin(ScrollTrigger, SplitText);
const html = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const motionOk = () => !reduce.matches;
html.classList.toggle("no-motion", reduce.matches);
html.classList.remove("no-js");

/* ---------- Scroll suave ---------- */
let lenis = null;
if (motionOk()) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
export const scroller = { lenis, gsap, ScrollTrigger, motionOk, fine };
window.g2 = scroller;

function topOffset() {
  return document.querySelector(".topbar")?.offsetHeight ?? 64;
}
function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { offset: -topOffset() + 1, duration: 1.4 });
  else target.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto" });
}

/* ---------- Obturador entre páginas: dos hojas que cierran y abren como un párpado ---------- */
const STORE = "g2-obturador";
const themes = {
  "index.html": { color: "#080b0f", ink: "#f2a33a", num: "G2", label: "Tres miradas sobre la montaña" },
  "montana.html": { color: "#080b0f", ink: "#f2a33a", num: "02", label: "Ver venir la montaña" },
  "pisos.html": { color: "#080b0f", ink: "#8fcb6b", num: "03", label: "Cinco montañas, una red" },
  "ojos.html": { color: "#080b0f", ink: "#8fd3e8", num: "01", label: "Ojos en la ladera" },
  "datos.html": { color: "#080b0f", ink: "#fff4e0", num: "↓", label: "Datos abiertos" },
};
const curtain = document.createElement("div");
curtain.className = "curtain";
curtain.setAttribute("aria-hidden", "true");
curtain.innerHTML = "<span></span><span></span>";
const curtainLabel = document.createElement("div");
curtainLabel.className = "curtain-label";
curtainLabel.setAttribute("aria-hidden", "true");
document.body.append(curtain, curtainLabel);
const panels = [...curtain.children];

function pageOf(url) {
  const name = url.pathname.split("/").pop();
  return name === "" ? "index.html" : name;
}
function paintCurtain(theme) {
  curtain.style.setProperty("--curtain", theme.color);
  curtainLabel.style.setProperty("--curtain-ink", theme.ink);
  curtainLabel.innerHTML = `<span class="num"></span><small></small>`;
  curtainLabel.querySelector(".num").textContent = theme.num;
  curtainLabel.querySelector("small").textContent = theme.label;
}

function arrive() {
  let theme = null;
  try { theme = JSON.parse(sessionStorage.getItem(STORE) || "null"); } catch { /* sin almacenamiento */ }
  try { sessionStorage.removeItem(STORE); } catch { /* sin almacenamiento */ }
  if (!theme || !motionOk()) {
    html.classList.remove("is-arriving");
    return;
  }
  paintCurtain(theme);
  gsap.set(panels, { scaleY: 1 });
  gsap.set(curtainLabel, { opacity: 1 });
  html.classList.remove("is-arriving");
  gsap.timeline({ delay: 0.15 })
    .to(curtainLabel, { opacity: 0, scale: 0.96, duration: 0.4, ease: "power2.in" })
    .to(panels, { scaleY: 0, duration: 0.95, ease: "expo.inOut" }, "<0.15");
}

function leave(url) {
  const theme = themes[pageOf(url)] ?? themes["index.html"];
  try { sessionStorage.setItem(STORE, JSON.stringify(theme)); } catch { /* sin almacenamiento */ }
  paintCurtain(theme);
  lenis?.stop();
  gsap.timeline({ onComplete: () => { location.href = url.href; } })
    .fromTo(panels, { scaleY: 0 }, { scaleY: 1, duration: 0.75, ease: "expo.inOut" })
    .fromTo(curtainLabel, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }, "-=0.25");
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.target && link.target !== "_self") return;
  if (link.hasAttribute("download")) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  const samePage = url.pathname === location.pathname && url.search === location.search;
  if (samePage && url.hash) {
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) {
      event.preventDefault();
      history.pushState(null, "", url.hash);
      scrollToTarget(target);
      closeMenu();
    }
    return;
  }
  if (!/\.html$|\/$/.test(url.pathname) || !motionOk()) return;
  event.preventDefault();
  leave(url);
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    gsap.set(panels, { scaleY: 0 });
    gsap.set(curtainLabel, { opacity: 0 });
    lenis?.start();
  }
});

/* ---------- Barra superior, menú y progreso ---------- */
const topbar = document.querySelector(".topbar");
const menuButton = topbar?.querySelector(".menu-btn");
function closeMenu() {
  topbar?.classList.remove("menu-open");
  menuButton?.setAttribute("aria-expanded", "false");
}
menuButton?.addEventListener("click", () => {
  const open = !topbar.classList.contains("menu-open");
  topbar.classList.toggle("menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});
let lastY = scrollY;
function onScroll() {
  const y = scrollY;
  topbar?.classList.toggle("is-solid", y > 30 || !document.querySelector(".hero, .ch-hero"));
  if (topbar && !topbar.classList.contains("menu-open")) topbar.classList.toggle("is-hidden", y > 420 && y > lastY + 2);
  if (y < lastY - 2) topbar?.classList.remove("is-hidden");
  lastY = y;
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();
const bar = document.createElement("div");
bar.className = "progress";
bar.innerHTML = "<span></span>";
document.body.append(bar);
gsap.to(bar.firstChild, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

/* ---------- Lectura de la ladera en la barra (km locales del tramo, sin coordenadas) ---------- */
const readout = document.querySelector("[data-geo-readout]");
const homeText = document.body.dataset.readout || "Corredor de 10 km · red STN";
const km = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function showGeo({ x, y, elev, clase } = {}) {
  if (!readout) return;
  if (x === undefined) {
    readout.innerHTML = `<span>${homeText}</span>`;
    return;
  }
  readout.innerHTML = `<span>E <b>${km.format(x)} km</b></span><span>S <b>${km.format(y)} km</b></span><span><b>${Math.round(elev).toLocaleString("es-CO")} m</b></span>` + (clase ? `<span>${clase}</span>` : "");
}
addEventListener("g2:geo", (event) => showGeo(event.detail));
showGeo();

/* ---------- Revelados ---------- */
function setupReveals() {
  if (!motionOk()) return;
  for (const el of document.querySelectorAll("[data-split]")) {
    const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-line" });
    gsap.from(split.lines, {
      yPercent: 108, duration: 1.05, ease: "expo.out", stagger: 0.09,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  }
  for (const el of document.querySelectorAll("[data-reveal]")) {
    gsap.fromTo(el, { opacity: 0, y: 36 }, {
      opacity: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  }
  for (const el of document.querySelectorAll("[data-parallax]")) {
    const amount = Number(el.dataset.parallax) || 12;
    gsap.fromTo(el, { yPercent: -amount }, { yPercent: amount, ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
  }
}
if (!motionOk()) document.querySelectorAll("[data-reveal]").forEach((el) => { el.style.opacity = 1; });

/* ---------- Título de portada: letras que suben y se levantan cerca del cursor ---------- */
function setupHeroTitle() {
  const title = document.querySelector("[data-hero-title]");
  if (!title) return;
  const split = SplitText.create(title.querySelectorAll(".row"), { type: "words,chars", wordsClass: "word", charsClass: "char" });
  if (motionOk()) {
    gsap.from(split.chars, { yPercent: 115, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.03, delay: 0.3 });
  }
  if (!fine.matches || !motionOk()) return;
  const chars = split.chars;
  const lift = chars.map((char) => gsap.quickTo(char, "y", { duration: 0.5, ease: "power3.out" }));
  const glow = chars.map((char) => gsap.quickTo(char, "color", { duration: 0.4 }));
  const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#f2a33a";
  const mix = gsap.utils.interpolate("#fff4e0", accent);
  let pointer = null;
  const section = title.closest("section");
  section.addEventListener("pointermove", (event) => { pointer = [event.clientX, event.clientY]; });
  section.addEventListener("pointerleave", () => { pointer = null; });
  let last = 0;
  gsap.ticker.add((time) => {
    if (time - last < 0.033) return;
    last = time;
    chars.forEach((char, i) => {
      let k = 0;
      if (pointer) {
        const box = char.getBoundingClientRect();
        k = clamp(1 - Math.hypot(pointer[0] - (box.left + box.width / 2), pointer[1] - (box.top + box.height / 2)) / 240, 0, 1);
      }
      lift[i](-k * 0.12 * char.offsetHeight);
      glow[i](mix(k));
    });
  });
}

/* ---------- Botones magnéticos ---------- */
function setupMagnets() {
  if (!fine.matches || !motionOk()) return;
  for (const el of document.querySelectorAll("[data-magnet]")) {
    const strength = Number(el.dataset.magnet) || 0.3;
    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, .45)" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, .45)" });
    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      x((event.clientX - box.left - box.width / 2) * strength);
      y((event.clientY - box.top - box.height / 2) * strength);
    });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  }
}

/* ---------- Marquesina que responde a la velocidad del scroll ---------- */
function setupMarquees() {
  for (const root of document.querySelectorAll("[data-marquee]")) {
    const track = root.querySelector(".marquee-track");
    const item = track.firstElementChild;
    const copies = Math.max(2, Math.ceil((innerWidth * 2) / Math.max(item.offsetWidth, 1)));
    for (let i = 1; i < copies; i++) {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.append(clone);
    }
    if (!motionOk()) continue;
    const speed = Number(root.dataset.marquee) || 60;
    let offset = 0;
    let direction = 1;
    gsap.ticker.add((_, delta) => {
      const velocity = lenis ? lenis.velocity : 0;
      if (Math.abs(velocity) > 0.2) direction = Math.sign(velocity);
      const boost = clamp(Math.abs(velocity) * 0.6, 0, 22);
      offset -= direction * (speed + boost * 60) * (delta / 1000);
      const width = item.offsetWidth;
      if (width) offset = ((offset % width) - width) % width;
      track.style.transform = `translate3d(${offset}px,0,0)`;
    });
  }
}

/* ---------- Contadores ---------- */
export function countUp(el, value, { decimals = 0, prefix = "", suffix = "", sign = false } = {}) {
  const format = new Intl.NumberFormat("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, signDisplay: sign ? "exceptZero" : "auto" });
  const paint = (v) => { el.innerHTML = `${prefix}${format.format(v)}${suffix}`; };
  if (!motionOk()) { paint(value); return; }
  const state = { v: 0 };
  paint(0);
  ScrollTrigger.create({
    trigger: el, start: "top 92%", once: true,
    onEnter: () => gsap.to(state, { v: value, duration: 2, ease: "power3.out", onUpdate: () => paint(state.v) }),
  });
}
function setupCounters() {
  for (const el of document.querySelectorAll("[data-count]")) {
    countUp(el, Number(el.dataset.count), { decimals: Number(el.dataset.decimals || 0), prefix: el.dataset.prefix || "", suffix: el.dataset.suffix || "" });
  }
}

/* ---------- Tarjetas apiladas ---------- */
function setupStack() {
  if (!motionOk() || !matchMedia("(min-width: 761px)").matches) return;
  const cards = [...document.querySelectorAll(".stack-card")];
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.93, filter: "brightness(.6)", ease: "none",
      scrollTrigger: { trigger: next, start: "top bottom", end: "top top+=120", scrub: true },
    });
  });
}

/* ---------- Portada de capítulo: la toma vertical avanza con el scroll y se abren las bandas ---------- */
const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}:${String(Math.floor((seconds % 1) * 30)).padStart(2, "0")}`;
function setupChapterHero() {
  const hero = document.querySelector(".ch-hero");
  if (!hero) return;
  const rows = hero.querySelectorAll("h1 .row");
  const copy = hero.querySelector(".ch-hero-copy");
  const film = hero.querySelector(".film video");
  const filmBox = hero.querySelector(".film");
  const filmBar = hero.querySelector(".film-bar");
  const code = hero.querySelector("[data-timecode]");
  const boxes = hero.querySelectorAll(".letterbox");
  const scrubbed = matchMedia("(min-width: 761px)").matches && motionOk();
  const load = () => {
    if (!film || film.getAttribute("src")) return;
    film.src = film.dataset.src;
    film.preload = "auto";
    film.addEventListener("loadeddata", () => {
      film.classList.add("ready");
      if (!scrubbed) {
        film.loop = true;
        film.muted = true;
        if (motionOk()) film.play().catch(() => {});
      }
    }, { once: true });
  };
  if (!motionOk()) { load(); return; }
  gsap.from(rows, { yPercent: 105, duration: 1.25, ease: "expo.out", stagger: 0.1, delay: 0.35 });
  gsap.from(copy.querySelectorAll(".kicker, .lede, .ch-meta, .hero-actions"), { opacity: 0, y: 24, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.7 });
  if (filmBox) gsap.from(filmBox, { opacity: 0, y: 60, rotate: 2, duration: 1.6, ease: "expo.out", delay: 0.25 });
  setTimeout(load, 400);
  if (scrubbed) {
    gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom bottom", scrub: 0.5 } })
      .to(boxes, { "--lb": "-100%", duration: 0.25, ease: "power2.out" }, 0)
      .to(filmBox, { scale: 1.06, duration: 1, ease: "none" }, 0)
      .to(copy, { yPercent: -14, opacity: 0.15, duration: 0.6, ease: "power1.in" }, 0.4);
  }
  ScrollTrigger.create({
    trigger: hero, start: "top top", end: "bottom bottom",
    onUpdate: (self) => {
      filmBar?.style.setProperty("--p", self.progress.toFixed(3));
      if (!scrubbed || !film || !Number.isFinite(film.duration)) return;
      const t = clamp(self.progress, 0, 0.985) * film.duration;
      if (!film.seeking) film.currentTime = t;
      if (code) code.textContent = clock(t);
    },
  });
  if (!scrubbed && film && code) film.addEventListener("timeupdate", () => { code.textContent = clock(film.currentTime); });
}

/* ---------- Tarjetas de la trilogía: la toma se reproduce al pasar el cursor o al verse ---------- */
function setupReelCards() {
  for (const card of document.querySelectorAll(".reel-card[data-clip]")) {
    let video = null;
    const play = () => {
      if (!motionOk()) return;
      if (!video) {
        video = document.createElement("video");
        Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "auto" });
        video.src = card.dataset.clip;
        video.setAttribute("aria-hidden", "true");
        card.prepend(video);
      }
      video.play().then(() => card.classList.add("is-playing")).catch(() => {});
    };
    const stop = () => {
      card.classList.remove("is-playing");
      video?.pause();
    };
    if (fine.matches) {
      card.addEventListener("pointerenter", play);
      card.addEventListener("pointerleave", stop);
      card.addEventListener("focus", play);
      card.addEventListener("blur", stop);
    } else {
      new IntersectionObserver(([entry]) => (entry.intersectionRatio > 0.6 ? play() : stop()), { threshold: [0, 0.6] }).observe(card);
    }
  }
}

/* ---------- Escenas que se cargan al acercarse ---------- */
const scenes = [
  ["[data-hero-map]", () => import("./portada.js"), "setupHero"],
  ["[data-maqueta]", () => import("./maqueta.js"), "setupMaqueta"],
  ["[data-compare]", () => import("./comparador.js"), "setupCompare"],
  ["[data-player]", () => import("./reproductor.js"), "setupPlayer"],
  ["[data-chart]", () => import("./graficas.js"), "setupChart"],
  ["[data-pisos]", () => import("./pisos.js"), "setupPisos"],
  ["[data-dots]", () => import("./inventario.js"), "setupDots"],
  ["[data-mapa]", () => import("./inventario.js"), "setupMapa"],
];
function loadScenes() {
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      near.unobserve(entry.target);
      const { loader, name } = entry.target.__scene;
      Promise.resolve(loader(entry.target)).then((module) => module[name](entry.target, { reduce, fine, lenis }))
        .catch((error) => console.error(name, error))
        .finally(() => ScrollTrigger.refresh());
    }
  }, { rootMargin: "120% 0px" });
  for (const [selector, loader, name] of scenes) {
    for (const el of document.querySelectorAll(selector)) {
      el.__scene = { loader, name };
      near.observe(el);
    }
  }
}

arrive();
setupHeroTitle();
setupMarquees();
setupChapterHero();
setupReelCards();
setupStack();
setupMagnets();
loadScenes();
document.fonts.ready.then(() => {
  setupReveals();
  setupCounters();
  ScrollTrigger.refresh();
});
let bodyHeight = 0;
let refreshTimer = 0;
new ResizeObserver(([entry]) => {
  const height = Math.round(entry.contentRect.height);
  if (Math.abs(height - bodyHeight) < 3) return;
  bodyHeight = height;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
}).observe(document.body);
if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) setTimeout(() => scrollToTarget(target), 400);
}
