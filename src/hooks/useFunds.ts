import { useQuery } from "@tanstack/react-query";
import { fetchSgaFunds, type FetchSgaFundsOptions } from "@/services/funds";

export const fundKeys = {
  all: ["funds"] as const,
  lists: (options: FetchSgaFundsOptions = {}) => [...fundKeys.all, "list", options] as const,
};

export function useSgaFunds(options: FetchSgaFundsOptions | string = {}) {
  const resolvedOptions = typeof options === "string" ? { search: options } : options;
  return useQuery({
    queryKey: fundKeys.lists(resolvedOptions),
    queryFn: () => fetchSgaFunds(resolvedOptions),
  });
}
