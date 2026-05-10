import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";

interface WorkspaceHeaderProps {
  workspaceName: string;
  envChip?: React.ReactNode;
}

/**
 * Global app header. Scope is intentionally narrow: it tells you which Boson
 * project you have open and lets you switch environments. Everything that
 * pertains to the *currently selected request* (name editing, draft state,
 * save/discard actions) lives in `RequestBar` instead, where it belongs to
 * the same visual scope as the method/URL/Send controls.
 */
export function WorkspaceHeader({
  workspaceName,
  envChip,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="truncate text-xs font-medium text-foreground">
              {workspaceName || "Boson"}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">{envChip}</div>
    </header>
  );
}
