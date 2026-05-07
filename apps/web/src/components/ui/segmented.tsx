import { cn } from "@/lib/utils";

export type SegmentedItem<T extends string> = {
  id: T;
  label: string;
};

export function Segmented<T extends string>({
  items,
  active,
  onChange,
  className,
  size = "sm",
}: {
  items: readonly SegmentedItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "xs";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-muted/50 inline-flex items-center rounded-md p-0.5",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center justify-center rounded-[6px] font-medium transition-colors cursor-pointer",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-6 px-2 text-[11px]",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
