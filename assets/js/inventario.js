// Matrices de puntos del inventario y capas del mapa nacional.
import { gsap, ScrollTrigger } from "../vendor/motion.js";

// <div class="dots" data-dots data-value="9883" data-per="25">: un punto por cada «per» eventos.
export function setupDots(root, { reduce }) {
  const value = Number(root.dataset.value);
  const per = Number(root.dataset.per) || 25;
  const count = Math.round(value / per);
  root.innerHTML = "<i></i>".repeat(count);
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", `${value.toLocaleString("es-CO")} eventos; cada punto representa ${per}`);
  if (reduce.matches) { root.classList.add("done"); return; }
  ScrollTrigger.create({
    trigger: root, start: "top 80%", once: true,
    onEnter: () => gsap.to(root.children, { scale: 1, duration: 0.5, ease: "back.out(2)", stagger: { each: Math.min(0.012, 2.2 / count), from: "start" } }),
  });
}

// Botones [data-mapa-capa] que muestran u ocultan img[data-capa] dentro del mapa.
export function setupMapa(root) {
  const buttons = [...root.querySelectorAll("[data-mapa-capa]")];
  const layers = Object.fromEntries([...root.querySelectorAll("img[data-capa]")].map((img) => [img.dataset.capa, img]));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const on = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(on));
      layers[button.dataset.mapaCapa].hidden = !on;
    });
  }
}
