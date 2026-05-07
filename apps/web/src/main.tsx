import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ApiClient } from "@/components/api-client";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/context/auth-context";
import { WorkspaceProvider } from "@/context/workspace-context";
import { useLocationPath } from "@/lib/router";
import { LoginPage } from "@/pages/login-page";

function Routes() {
  const path = useLocationPath();

  if (path === "/login") {
    return <LoginPage />;
  }

  return (
    <WorkspaceProvider>
      <AppShell main={<ApiClient />} />
    </WorkspaceProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
