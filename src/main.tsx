import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a new version is published, old page files are replaced. A tab opened
// before that would fail to load them, so reload once to get the new version.
window.addEventListener("vite:preloadError", (event) => {
  const key = "chunk-reload-at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10000) {
    event.preventDefault();
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
