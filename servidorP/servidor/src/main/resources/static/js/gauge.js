
(function (w) {
  "use strict";

  const Phishware = (w.Phishware = w.Phishware || {});

  const RADIUS = 88;
  const CIRC = 2 * Math.PI * RADIUS;

  const COLORS = { low: "#1a9e66", medium: "#e9a20c", high: "#c0332a", unknown: "#5b6b80" };

  const REDUCED = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animations = new WeakMap();

  function levelFromPct(pct) {
    if (pct < 35) return "low";
    if (pct < 65) return "medium";
    return "high";
  }

  function mount(el) {
    if (!el) return;

    el.innerHTML =
      '<svg viewBox="0 0 200 200" role="img" aria-label="Pontuação de risco">' +
      '<circle class="g-track" cx="100" cy="100" r="' + (RADIUS - 7) + '"></circle>' +
      '<circle class="g-bar" cx="100" cy="100" r="' + RADIUS + '" stroke-dasharray="' + CIRC +
      '" stroke-dashoffset="' + CIRC + '" transform="rotate(-90 100 100)"></circle>' +
      "</svg>" +
      '<div class="g-center"><span class="g-value">0</span><span class="g-unit">de 100</span></div>';
  }

  function countUp(node, to, duration, el) {
    if (REDUCED || duration <= 0) {
      node.textContent = Math.round(to);
      return;
    }

    const start = w.performance.now();
    let id;

    function frame(now) {
      if (animations.get(el) !== id) return;

      const t = Math.min((now - start) / duration, 1);
      node.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));

      if (t < 1) {
        id = w.requestAnimationFrame(frame);
        animations.set(el, id);
      } else {
        animations.delete(el);
      }
    }

    id = w.requestAnimationFrame(frame);
    animations.set(el, id);
  }

  function set(el, pct, level) {
    if (!el) return;
    if (!el.querySelector(".g-bar")) mount(el);

    const bar = el.querySelector(".g-bar");
    const value = el.querySelector(".g-value");
    const unit = el.querySelector(".g-unit");

    const previous = animations.get(el);
    if (previous !== undefined) {
      w.cancelAnimationFrame(previous);
      animations.delete(el);
    }

    const hasScore = typeof pct === "number" && Number.isFinite(pct);
    const clamped = hasScore ? Math.max(0, Math.min(100, pct)) : 0;
    const finalLevel = hasScore ? (COLORS[level] ? level : levelFromPct(clamped)) : "unknown";

    bar.style.stroke = COLORS[finalLevel];
    el.setAttribute("aria-label", hasScore ? "Pontuação de risco: " + Math.round(clamped) + " de 100" : "Pontuação não calculada");

    if (!hasScore) {
      bar.style.transition = "none";
      bar.style.strokeDashoffset = CIRC;
      value.textContent = "—";
      unit.textContent = "sem nota";
      return;
    }

    unit.textContent = "de 100";

    bar.style.transition = "none";
    bar.style.strokeDashoffset = CIRC;
    value.textContent = "0";
    void bar.getBoundingClientRect();
    bar.style.transition = "";

    w.requestAnimationFrame(function () {
      bar.style.strokeDashoffset = CIRC * (1 - clamped / 100);
      countUp(value, clamped, 1300, el);
    });
  }

  Phishware.Gauge = { mount: mount, set: set, levelFromPct: levelFromPct };

})(window);
