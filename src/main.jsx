import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div style={{ maxWidth: "1320px", width: "100%", margin: "0 auto", padding: "24px 16px", boxSizing: "border-box" }}>
      <App />
    </div>
  </React.StrictMode>
);
