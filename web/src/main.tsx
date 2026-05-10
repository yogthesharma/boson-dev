import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";

import { App } from "./App";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("missing #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="boson-theme"
      disableTransitionOnChange
    >
      <App />
      <Toaster richColors />
    </ThemeProvider>
  </StrictMode>,
);
