import { BrandLogo } from "@/components/brand-logo";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface SidebarBrandProps {
  /** Running server version, rendered as a small pill. */
  version: string | null;
}

/**
 * Product identity at the top of the sidebar.
 *
 * Single line: `[logo] Boson  v0.1.0`. The project name intentionally lives
 * only in the workspace header's breadcrumb so the sidebar can stay pure
 * product branding regardless of which project is open. The logo tile stays
 * visible when the sidebar collapses to icon-only mode.
 */
export function SidebarBrand({ version }: SidebarBrandProps) {
  return (
    <SidebarMenuButton
      size="lg"
      tooltip="Boson"
      className="cursor-default select-none gap-2.5 hover:bg-transparent active:bg-transparent"
    >
      <div className="flex aspect-square size-7 shrink-0 items-center justify-center rounded-md bg-primary p-1.5 text-primary-foreground">
        <BrandLogo className="size-full" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm font-semibold tracking-tight">
          Boson
        </span>
        {version ? (
          <span className="shrink-0 font-mono text-[10px] leading-none text-muted-foreground">
            v{version}
          </span>
        ) : null}
      </div>
    </SidebarMenuButton>
  );
}
