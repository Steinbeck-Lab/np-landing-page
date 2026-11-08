// Animates the RDKit-generated 2D coordinates of natural products (public/molecules.json).
const NS = "http://www.w3.org/2000/svg";
const root = document.getElementById("mol");
if (root) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = { N: "#355a83", O: "#984a3d" };
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };

  const SUB = "₀₁₂₃₄₅₆₇₈₉";
  function draw(m) {
    root.replaceChildren();
    document.getElementById("mol-name").textContent = m.name;
    document.getElementById("mol-formula").textContent = m.formula.replace(
      /\d/g,
      (d) => SUB[d],
    );
    const bonds = el(
      "g",
      { stroke: "#537856", "stroke-width": 2.6, "stroke-linecap": "round" },
      root,
    );
    m.bonds.forEach((b, n) => {
      const A = m.atoms[b.a];
      const B = m.atoms[b.b];
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      const ux = (B.x - A.x) / len;
      const uy = (B.y - A.y) / len;
      const ta = A.e === "C" ? 0 : 12;
      const tb = B.e === "C" ? 0 : 12;
      const [x1, y1] = [A.x + ux * ta, A.y + uy * ta];
      const [x2, y2] = [B.x - ux * tb, B.y - uy * tb];
      const offsets = b.o === 2 ? [-3.5, 3.5] : b.o === 3 ? [-5, 0, 5] : [0];
      for (const o of offsets) {
        el(
          "line",
          {
            x1: x1 - uy * o,
            y1: y1 + ux * o,
            x2: x2 - uy * o,
            y2: y2 + ux * o,
            pathLength: 1,
            class: "bond",
            style: `--d:${reduced ? 0 : n * 40}ms`,
          },
          bonds,
        );
      }
    });
    m.atoms.forEach((a, i) => {
      if (a.e === "C") return;
      const g = el(
        "g",
        { class: "atom", style: `--d:${reduced ? 0 : 150 + i * 40}ms` },
        root,
      );
      const t = el(
        "text",
        {
          x: a.x,
          y: a.y + 7.5,
          "text-anchor": "middle",
          "font-size": 22,
          "font-weight": 600,
          fill: COLORS[a.e] || "#172e29",
        },
        g,
      );
      t.textContent = a.e;
    });
  }

  fetch("/assets/molecules.json")
    .then((r) => r.json())
    .then((mols) => {
      let i = 0;
      draw(mols[0]);
      if (reduced) return;
      // Swap to the next structure and redraw it bond by bond.
      setInterval(() => {
        root.classList.add("out");
        setTimeout(() => {
          root.classList.remove("out");
          i = (i + 1) % mols.length;
          draw(mols[i]);
        }, 300);
      }, 3000);
    })
    .catch(() => {});
}
