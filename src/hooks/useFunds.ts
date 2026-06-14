import { useQuery } from "@tanstack/react-query";
import { fetchSgaFunds } from "@/services/funds";

export const fundKeys = {
  all: ["funds"] as const,
  lists: (search?: string) => [...fundKeys.all, "list", search ?? ""] as const,
};

export function useSgaFunds(search?: string) {
  return useQuery({
    queryKey: fundKeys.lists(search),
    queryFn: () => fetchSgaFunds(search),
  });
}
