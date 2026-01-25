import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css"; // or styles.css if that’s what you named it

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
