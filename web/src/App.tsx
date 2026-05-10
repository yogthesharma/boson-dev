import { AppSidebar } from "@/components/sidebar/app-sidebar";
import {
  BootstrapErrorScreen,
  LoadingScreen,
} from "@/components/boot-states";
import { EnvChip } from "@/components/env-chip";
import { RequestBar } from "@/components/request-bar";
import { RequestPane } from "@/components/request-pane";
import { ResponsePane } from "@/components/response-pane";
import { WorkspaceHeader } from "@/components/workspace-header";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useCurrentRequest } from "@/hooks/use-current-request";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useProject } from "@/hooks/use-project";
import { useRequestActions } from "@/hooks/use-request-actions";
import { useVariables } from "@/hooks/use-variables";

export function App() {
  const {
    project,
    history,
    version,
    loading,
    bootstrapError,
    selectedRequestId,
    selectedEnvironmentId,
    setSelectedRequestId,
    setSelectedEnvironmentId,
    refresh,
  } = useProject();

  const {
    form,
    setQuery,
    setHeaders,
    setBody,
    setAuth,
    setOptions,
    patchForm,
    draftRequest,
  } = useCurrentRequest(project, selectedRequestId);

  const variables = useVariables(project, selectedEnvironmentId);

  const { running, runSelectedRequest } = useRequestActions({
    selectedRequestId,
    selectedEnvironmentId,
    draftRequest,
    refresh,
  });

  useKeyboardShortcuts({
    onRun: selectedRequestId && !running ? runSelectedRequest : undefined,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (bootstrapError && !project) {
    return <BootstrapErrorScreen message={bootstrapError} />;
  }

  const latestForRequest = history.find(
    (item) => item.request_id === selectedRequestId,
  );

  return (
    <SidebarProvider>
      <AppSidebar
        project={project}
        version={version?.version ?? null}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
      />
      <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden">
        <WorkspaceHeader
          workspaceName={project?.name ?? "Boson"}
          envChip={
            <EnvChip
              environments={project?.environments ?? []}
              currentId={selectedEnvironmentId}
              onSelect={setSelectedEnvironmentId}
            />
          }
        />

        <RequestBar
          method={form.method}
          url={form.url}
          running={running}
          canRun={Boolean(selectedRequestId)}
          variables={variables}
          onMethodChange={(method) => patchForm({ method })}
          onUrlChange={(url) => patchForm({ url })}
          onRun={runSelectedRequest}
        />

        <ResizablePanelGroup
          orientation="vertical"
          className="min-h-0 flex-1"
        >
          <ResizablePanel defaultSize={48} minSize={20}>
            <RequestPane
              query={form.query}
              headers={form.headers}
              body={form.body}
              auth={form.auth}
              options={form.options}
              variables={variables}
              onQueryChange={setQuery}
              onHeadersChange={setHeaders}
              onBodyChange={setBody}
              onAuthChange={setAuth}
              onOptionsChange={setOptions}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={52} minSize={20}>
            <ResponsePane item={latestForRequest} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}
