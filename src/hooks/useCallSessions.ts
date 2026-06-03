import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCallSession,
  fetchCallSessions,
  type CallSessionFilters,
  type CreateCallSessionPayload,
} from "@/services/callSessions";

export const callSessionKeys = {
  all: ["call_sessions"] as const,
  list: (filters?: CallSessionFilters) => [...callSessionKeys.all, filters ?? {}] as const,
};

export function useCallSessions(filters?: CallSessionFilters) {
  return useQuery({
    queryKey: callSessionKeys.list(filters),
    queryFn: () => fetchCallSessions(filters),
  });
}

export function useCreateCallSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCallSessionPayload) => createCallSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callSessionKeys.all });
    },
  });
}
