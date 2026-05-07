import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ApiClient } from "@/components/api-client";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/context/workspace-context";

function App() {
  return (
    <WorkspaceProvider>
      <AppShell main={<ApiClient />} />
    </WorkspaceProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
