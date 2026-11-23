import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "@/styles/index.css";
import "@/styles/tokens.css";
import "@/styles/themes.css";
import "@/styles/styles.css";
import "@/styles/forced-colors.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
