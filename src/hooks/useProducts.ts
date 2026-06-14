import { useQuery } from "@tanstack/react-query";
import { fetchBundles, fetchProducts } from "@/services/products";

export const productKeys = {
  all: ["products"] as const,
  bundles: ["bundles"] as const,
};

export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: () => fetchProducts(),
  });
}

export function useBundles() {
  return useQuery({
    queryKey: productKeys.bundles,
    queryFn: () => fetchBundles(),
  });
}
