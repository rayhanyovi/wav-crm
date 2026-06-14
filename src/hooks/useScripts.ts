import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScript,
  deleteScript,
  fetchScripts,
  updateScript,
  type CreateScriptPayload,
  type UpdateScriptPayload,
} from "@/services/scripts";
import { toast } from "@/store/useToastStore";

export const scriptKeys = {
  all: ["scripts"] as const,
};

export function useScripts() {
  return useQuery({
    queryKey: scriptKeys.all,
    queryFn: fetchScripts,
  });
}

export function useCreateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateScriptPayload) => createScript(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scriptKeys.all });
      toast.success("Script created.");
    },
    onError: (err) => toast.error(`Couldn't create script: ${err instanceof Error ? err.message : "unknown error"}`),
  });
}

export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateScriptPayload }) =>
      updateScript(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scriptKeys.all });
      toast.success("Script saved.");
    },
    onError: (err) => toast.error(`Couldn't save script: ${err instanceof Error ? err.message : "unknown error"}`),
  });
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScript(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scriptKeys.all });
      toast.success("Script deleted.");
    },
    onError: (err) => toast.error(`Couldn't delete script: ${err instanceof Error ? err.message : "unknown error"}`),
  });
}
