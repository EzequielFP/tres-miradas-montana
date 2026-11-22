// Comparador Sentinel-2 de antes y después: cortina, parpadeo y lupa ×3.
import { clamp } from "./util.js";

const handleIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';

function curtain(root, onChange) {
  const view = root.querySelector(".cmp-view");
  const input = root.querySelector('input[type="range"]');
  const set = (value) => {
    const position = clamp(value, 0, 100);
    root.style.setProperty("--pos", `${position}%`);
    if (input) {
      input.value = position;
      input.setAttribute("aria-valuetext", `${Math.round(position)} % de la imagen de antes visible`);
    }
    onChange?.(position);
  };
  const fromEvent = (event) => {
    const box = view.getBoundingClientRect();
    set(((event.clientX - box.left) / box.width) * 100);
  };
  let dragging = false;
  view.addEventListener("pointerdown", (event) => {
    if (root.dataset.mode === "blink") return;
    dragging = true;
    view.setPointerCapture(event.pointerId);
    fromEvent(event);
  });
  view.addEventListener("pointermove", (event) => { if (dragging) fromEvent(event); });
  const stop = () => { dragging = false; };
  view.addEventListener("pointerup", stop);
  view.addEventListener("pointercancel", stop);
  input?.addEventListener("input", () => set(Number(input.value)));
  return set;
}

export function setupCompare(root) {
  const view = root.querySelector(".cmp-view");
  const lens = root.querySelector(".cmp-lens");
  const [bottom, top] = view.querySelectorAll("img");
  root.querySelector(".cmp-handle b").innerHTML = handleIcon;
  let position = 50;
  const set = curtain(root, (value) => { position = value; });
  set(50);

  root.querySelectorAll("[data-cmp-mode]").forEach((button, _, all) => button.addEventListener("click", () => {
    root.dataset.mode = button.dataset.cmpMode;
    all.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  }));

  const zoom = 3;
  const lensButton = root.querySelector("[data-cmp-lens]");
  let lensOn = false;
  lensButton?.addEventListener("click", () => {
    lensOn = !lensOn;
    lensButton.setAttribute("aria-pressed", String(lensOn));
    if (!lensOn) lens.classList.remove("on");
  });
  view.addEventListener("pointermove", (event) => {
    if (!lensOn || event.pointerType !== "mouse") return;
    const box = view.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    const showTop = root.dataset.mode === "blink" ? getComputedStyle(top).opacity > 0.5 : (x / box.width) * 100 < position;
    lens.classList.add("on");
    lens.style.left = `${x}px`;
    lens.style.top = `${y}px`;
    lens.style.backgroundImage = `url("${(showTop ? top : bottom).currentSrc}")`;
    lens.style.backgroundSize = `${box.width * zoom}px ${box.height * zoom}px`;
    lens.style.backgroundPosition = `${-x * zoom + 95}px ${-y * zoom + 95}px`;
  });
  view.addEventListener("pointerleave", () => lens.classList.remove("on"));
}
