import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.compiled.js";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(React.createElement(App));
}
