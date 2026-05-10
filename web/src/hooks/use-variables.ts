import { useEffect, useMemo } from "react";

import { setMonacoVariables } from "@/components/ui/code-editor";
import {
  EMPTY_VARIABLES,
  type ProjectVariables,
} from "@/lib/variables";
import type { ProjectView } from "@/types";

/**
 * Derive a `ProjectVariables` snapshot from the loaded project + the
 * currently selected environment id, and push that snapshot into Monaco's
 * global completion / hover providers so every code editor sees the same
 * variables as the rest of the UI.
 */
export function useVariables(
  project: ProjectView | null,
  selectedEnvironmentId: string,
): ProjectVariables {
  const variables = useMemo<ProjectVariables>(() => {
    if (!project) return EMPTY_VARIABLES;
    const currentEnv =
      project.environments.find((env) => env.id === selectedEnvironmentId) ??
      null;
    const env = new Map<string, string>();
    if (currentEnv) {
      for (const [key, value] of Object.entries(currentEnv.variables)) {
        env.set(key, value);
      }
    }
    return {
      env,
      secrets: new Set(project.secret_names ?? []),
      environmentName: currentEnv?.name ?? null,
      environmentId: currentEnv?.id ?? null,
    };
  }, [project, selectedEnvironmentId]);

  useEffect(() => {
    setMonacoVariables(variables);
  }, [variables]);

  return variables;
}
