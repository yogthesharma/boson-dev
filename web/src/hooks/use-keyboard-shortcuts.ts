import { useEffect } from "react";

interface ShortcutHandlers {
  onRun?: () => void;
  onSave?: () => void;
}

/**
 * Wires up the global Cmd/Ctrl+Enter (run) and Cmd/Ctrl+S (save) shortcuts.
 *
 * - We deliberately don't bail when the focus is inside an `<input>`/`<textarea>`
 *   so users can fire from anywhere in the editor (Postman/Insomnia behaviour).
 * - Save (`mod+s`) calls `preventDefault` so the browser doesn't try to save
 *   the page.
 */
export function useKeyboardShortcuts({ onRun, onSave }: ShortcutHandlers) {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key === "Enter") {
        if (!onRun) return;
        event.preventDefault();
        onRun();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        if (!onSave) return;
        event.preventDefault();
        onSave();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onRun, onSave]);
}
