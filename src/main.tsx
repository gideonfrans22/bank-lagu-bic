import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import MissingEnv from "@/components/MissingEnv.tsx";
import { isSupabaseConfigured } from "@/env";
import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  document.body.innerHTML =
    '<p style="padding:1rem;font-family:system-ui">Missing #root div in index.html.</p>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        {isSupabaseConfigured ? (
          <BrowserRouter>
            <App />
          </BrowserRouter>
        ) : (
          <MissingEnv />
        )}
      </ErrorBoundary>
    </StrictMode>
  );
}
