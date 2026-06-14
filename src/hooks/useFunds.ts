import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchSgaFunds, fetchSgaFundsPage, type FetchSgaFundsOptions } from "@/services/funds";

export const fundKeys = {
  all: ["funds"] as const,
  lists: (options: FetchSgaFundsOptions = {}) => [...fundKeys.all, "list", options] as const,
  infinite: (options: FetchSgaFundsOptions = {}, pageSize: number) =>
    [...fundKeys.all, "infinite", options, pageSize] as const,
};

export function useSgaFunds(options: FetchSgaFundsOptions | string = {}) {
  const resolvedOptions = typeof options === "string" ? { search: options } : options;
  return useQuery({
    queryKey: fundKeys.lists(resolvedOptions),
    queryFn: () => fetchSgaFunds(resolvedOptions),
  });
}

export function useInfiniteSgaFunds(options: FetchSgaFundsOptions = {}, pageSize = 50, enabled = true) {
  return useInfiniteQuery({
    queryKey: fundKeys.infinite(options, pageSize),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchSgaFundsPage(options, pageParam, pageSize),
    enabled,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}
