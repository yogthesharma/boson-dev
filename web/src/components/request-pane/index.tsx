import { useState } from "react";

import { ParamsTab } from "@/components/request-pane/params-tab";
import { HeadersTab } from "@/components/request-pane/headers-tab";
import { BodyTab, BodyTabToolbar } from "@/components/request-pane/body-tab";
import { AuthTab } from "@/components/request-pane/auth-tab";
import { OptionsTab } from "@/components/request-pane/options-tab";
import { Tabs } from "@/components/ui/vercel-tabs";
import type {
  AuthForm,
  BodyForm,
  KvRow,
  OptionsForm,
} from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

type TabId = "params" | "headers" | "body" | "auth" | "options";

const TABS: { id: TabId; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "options", label: "Options" },
];

interface RequestPaneProps {
  query: KvRow[];
  headers: KvRow[];
  body: BodyForm;
  auth: AuthForm;
  options: OptionsForm;
  variables: ProjectVariables;
  onQueryChange: (rows: KvRow[]) => void;
  onHeadersChange: (rows: KvRow[]) => void;
  onBodyChange: (body: BodyForm) => void;
  onAuthChange: (auth: AuthForm) => void;
  onOptionsChange: (options: OptionsForm) => void;
}

export function RequestPane({
  query,
  headers,
  body,
  auth,
  options,
  variables,
  onQueryChange,
  onHeadersChange,
  onBodyChange,
  onAuthChange,
  onOptionsChange,
}: RequestPaneProps) {
  const [activeTab, setActiveTab] = useState<TabId>("params");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 px-4">
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />

        {activeTab === "body" ? (
          <div className="ml-auto">
            <BodyTabToolbar body={body} onChange={onBodyChange} />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "params" ? (
          <ParamsTab
            rows={query}
            onChange={onQueryChange}
            variables={variables}
          />
        ) : null}

        {activeTab === "headers" ? (
          <HeadersTab
            rows={headers}
            onChange={onHeadersChange}
            variables={variables}
          />
        ) : null}

        {activeTab === "body" ? (
          <BodyTab
            body={body}
            onChange={onBodyChange}
            variables={variables}
          />
        ) : null}

        {activeTab === "auth" ? (
          <div className="p-4">
            <AuthTab
              auth={auth}
              onChange={onAuthChange}
              variables={variables}
            />
          </div>
        ) : null}

        {activeTab === "options" ? (
          <div className="p-4">
            <OptionsTab options={options} onChange={onOptionsChange} />
          </div>
        ) : null}
      </div>

      {activeTab === "params" || activeTab === "headers" ? (
        <div className="shrink-0 px-5 py-2">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => {}}
          >
            Bulk Edit
          </button>
        </div>
      ) : null}
    </div>
  );
}
