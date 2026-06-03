import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 s — fresh enough for CRM data
      gcTime: 300_000,          // 5 min — keep unused cache alive
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
