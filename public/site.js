const filters = document.querySelector(".filters");
if (filters) {
  filters.hidden = false;
  const cards = [...document.querySelectorAll("[data-resource-category]")];
  const status = document.querySelector(".resource-count");
  for (const button of filters.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      for (const candidate of filters.querySelectorAll("button")) {
        candidate.classList.toggle("active", candidate === button);
        candidate.setAttribute("aria-pressed", String(candidate === button));
      }
      let count = 0;
      for (const card of cards) {
        card.hidden =
          button.dataset.category !== "All" &&
          card.dataset.resourceCategory !== button.dataset.category;
        if (!card.hidden) count++;
      }
      status.textContent = String(count);
    });
  }
}
