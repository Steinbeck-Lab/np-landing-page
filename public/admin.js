for (const form of document.querySelectorAll("[data-confirm-delete]")) {
  form.addEventListener("submit", (event) => {
    if (
      !window.confirm(
        "Delete this resource? This cannot be undone without restoring a backup.",
      )
    )
      event.preventDefault();
  });
}
for (const form of document.querySelectorAll("[data-logo-form]")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-upload-status]");
    const button = form.querySelector("button");
    status.textContent = "Uploading and optimizing your logo...";
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { "x-csrf-token": form.elements._csrf.value },
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          "Your session may have expired. Reload and sign in again before uploading.",
        );
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Upload failed. Please try again.");
      status.textContent = result.message;
      window.location.assign(result.redirect);
    } catch (error) {
      status.setAttribute("role", "alert");
      status.textContent =
        error.message ||
        "The upload could not be completed. Check your connection and try again.";
      button.disabled = false;
    }
  });
}
