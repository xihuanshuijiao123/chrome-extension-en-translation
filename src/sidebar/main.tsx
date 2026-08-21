import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "md-wx/dist/style.css";
import "./style.css";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
