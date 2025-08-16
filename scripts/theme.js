// Modo oscuro persistente en toda la web
document.addEventListener("DOMContentLoaded", () => {
  const darkToggle = document.getElementById("darkModeToggle");
  if (!darkToggle) return; // si no existe el botón, salir

  // Cargar preferencia guardada
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    darkToggle.textContent = "☀️";
  }

  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
      localStorage.setItem("theme", "dark");
      darkToggle.textContent = "☀️";
    } else {
      localStorage.setItem("theme", "light");
      darkToggle.textContent = "🌙";
    }
  });
});
