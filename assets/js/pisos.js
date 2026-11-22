// Ascensor de los cinco pisos: al hacer scroll (o al tocar un piso) cambia la toma 3D, las cifras
// del piso y lo que más pesa en el modelo allí. Datos: assets/data/zonas.json (cálculo propio).
import { gsap, ScrollTrigger } from "../vendor/motion.js";
import { fetchJson } from "./util.js";
import { NAMES } from "./graficas.js";

const LECTURA = {
  calido_seco: "Lo único que pesa de verdad es salir de la llanura y empezar a subir.",
  calido_humedo: "Las laderas empinadas del piedemonte: aquí manda el relieve.",
  templado_seco: "El único piso donde las fallas geológicas pesan casi tanto como la lluvia.",
  templado_humedo: "La roca y lo que la cubre. Es también la franja del café, entre 1.000 y 2.000 m.",
  frio: "Arriba manda la lluvia: casi la mitad de lo que pesa en el modelo.",
};
const fmt = (n, d = 0) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

export async function setupPisos(root, { reduce }) {
  const { zonas } = await fetchJson(new URL("../data/zonas.json", import.meta.url));
  const elevator = root.querySelector(".elevator");
  const data = root.querySelector(".floor-data");
  const film = root.querySelector(".film video");
  const poster = root.querySelector(".film img");
  const code = root.querySelector("[data-floor-code]");
  const maxAlta = Math.max(...zonas.map((z) => z.pct_alta));

  // De arriba (piso 5) hacia abajo (piso 1), como un ascensor.
  elevator.innerHTML = zonas.map((z, i) => ({ z, n: i + 1 })).reverse().map(({ z, n }) =>
    `<button class="floor" type="button" data-n="${n}" aria-pressed="false" style="--fc:${z.color}"><span class="n">${n}</span><span><strong>${z.nombre}</strong><small>${z.rango}</small></span><span class="pct">${fmt(z.pct_alta, 0)} %</span><i class="bar" style="--w:${(z.pct_alta / maxAlta) * 100}%"></i></button>`).join("");
  const buttons = [...elevator.querySelectorAll(".floor")];

  let current = 0;
  function show(n, { scroll = false } = {}) {
    if (n === current) return;
    current = n;
    const z = zonas[n - 1];
    root.style.setProperty("--fc", z.color);
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.n) === n)));
    const top = z.importancia.slice(0, 5);
    const max = top[0][1];
    data.innerHTML = `
      <p class="kicker"><b style="color:${z.color}">Piso ${n}</b> ${z.rango}</p>
      <h3 style="--fc:${z.color}">${z.nombre}</h3>
      <p class="lede" style="color:var(--text-2)">${LECTURA[z.id]}</p>
      <div class="floor-kpis">
        <div class="kpi"><span>Torres del piso en el 15 % más propenso</span><strong style="color:${z.color}">${fmt(z.pct_alta, 1)}<small> %</small></strong></div>
        <div class="kpi"><span>Eventos del inventario nacional por 100 km²</span><strong>${fmt(z.eventos_nacionales_100km2, 1)}</strong></div>
        <div class="kpi"><span>Torres de la red en este piso</span><strong>${fmt(z.torres)}<small> · ${fmt(z.pct_torres, 1)} %</small></strong></div>
        <div class="kpi"><span>Área del piso en el corredor</span><strong>${fmt(z.area_km2)}<small> km²</small></strong></div>
      </div>
      <div><p class="kicker" style="margin-bottom:10px"><b style="color:${z.color}">Lo que más pesa aquí</b> importancia en el modelo de este piso</p>
      <ul class="imp-bars reset-list">${top.map(([id, v]) => `<li><span>${NAMES[id] ?? id}</span><i style="transform:scaleX(${v / max})"></i><b>${fmt(v, 1)} %</b></li>`).join("")}</ul></div>
      <p class="fine">Modelo único ${fmt(z.auc_unico, 3)} frente a uno entrenado solo en este piso ${fmt(z.auc_local, 3)} (AUC). La importancia indica en qué se apoya el modelo; es asociación, no causa.</p>`;
    if (!reduce.matches) gsap.from(data.children, { opacity: 0, y: 18, duration: 0.6, stagger: 0.05, ease: "power3.out" });
    poster.src = `assets/media/cine/piso-${n}.webp`;
    if (code) code.textContent = `Piso ${n} · ${z.nombre}`;
    film.classList.remove("ready");
    film.src = `assets/media/cine/piso-${n}.mp4`;
    film.addEventListener("loadeddata", () => {
      film.classList.add("ready");
      if (!reduce.matches) film.play().catch(() => {});
    }, { once: true });
    if (scroll && trigger) {
      const progress = (n - 0.5) / zonas.length;
      const y = trigger.start + (trigger.end - trigger.start) * progress;
      window.g2?.lenis ? window.g2.lenis.scrollTo(y, { duration: 1 }) : window.scrollTo({ top: y });
    }
  }
  film.muted = true;
  film.loop = true;
  film.playsInline = true;

  // En pantallas anchas el escenario queda fijo y el scroll sube piso por piso.
  let trigger = null;
  const sticky = matchMedia("(min-width: 1081px)").matches;
  if (sticky) {
    trigger = ScrollTrigger.create({
      trigger: root, start: "top top+=80", end: "bottom bottom",
      onUpdate: (self) => show(Math.min(zonas.length, Math.floor(self.progress * zonas.length) + 1)),
    });
  }
  buttons.forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.n), { scroll: sticky })));
  show(1);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !reduce.matches) film.play().catch(() => {});
    else film.pause();
  }).observe(root);
}
