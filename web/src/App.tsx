import { AppSidebar } from "@/components/sidebar/app-sidebar";
import {
  BootstrapErrorScreen,
  LoadingScreen,
} from "@/components/boot-states";
import { RequestEditor } from "@/components/request-editor";
import { ResponsePanel } from "@/components/response-panel";
import { StaleDraftBanner } from "@/components/stale-draft-banner";
import { WorkspaceTopbar } from "@/components/workspace-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useCurrentRequest } from "@/hooks/use-current-request";
import { useProject } from "@/hooks/use-project";
import { useRequestActions } from "@/hooks/use-request-actions";

export function App() {
  const {
    project,
    history,
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
    setForm,
    headersText,
    setHeadersText,
    bodyText,
    setBodyText,
    selectedDraft,
    isStaleDraft,
    draftRequest,
  } = useCurrentRequest(project, selectedRequestId);

  const { running, saveDraft, saveToYaml, discardDraft, runSelectedRequest } =
    useRequestActions({
      selectedRequestId,
      selectedEnvironmentId,
      draftRequest,
      refresh,
    });

  if (loading) {
    return <LoadingScreen />;
  }

  if (bootstrapError && !project) {
    return <BootstrapErrorScreen message={bootstrapError} />;
  }

  return (
    <SidebarProvider>
      <AppSidebar
        project={project}
        history={history}
        selectedRequestId={selectedRequestId}
        selectedEnvironmentId={selectedEnvironmentId}
        onSelectRequest={setSelectedRequestId}
        onSelectEnvironment={setSelectedEnvironmentId}
      />
      <SidebarInset>
        <WorkspaceTopbar
          method={form.method}
          name={form.name}
          hasDraft={Boolean(selectedDraft)}
          running={running}
          canRun={Boolean(selectedRequestId)}
          onRun={runSelectedRequest}
        />

        <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6">
          {isStaleDraft ? <StaleDraftBanner /> : null}

          <RequestEditor
            form={form}
            onFormChange={setForm}
            headersText={headersText}
            onHeadersTextChange={setHeadersText}
            bodyText={bodyText}
            onBodyTextChange={setBodyText}
            hasDraft={Boolean(selectedDraft)}
            onSaveDraft={saveDraft}
            onSaveToYaml={saveToYaml}
            onDiscardDraft={discardDraft}
          />

          <ResponsePanel item={history[0]} />
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}
