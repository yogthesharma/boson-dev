import type { ReactNode } from "react";

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export function AppShell({ main }: { main: ReactNode }) {
  return (
    <div className="bg-background h-dvh min-h-0 w-full overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        id="root-shell"
        className="h-full"
      >
        <ResizablePanel
          id="sidebar"
          defaultSize="14%"
          minSize="10%"
          maxSize="22%"
          className="min-h-0"
        >
          <Sidebar />
        </ResizablePanel>

        <ResizablePanel
          id="main-area"
          defaultSize="86%"
          minSize="60%"
          className="min-h-0 min-w-0"
        >
          <div className="flex h-full min-h-0 flex-col">
            <TopBar />
            <div className="min-h-0 flex-1 overflow-hidden">{main}</div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
