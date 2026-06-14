import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  convertLead,
  createDeal,
  createDealProposal,
  deleteDeal,
  deleteDealProposal,
  fetchDealById,
  fetchDealProposals,
  fetchDeals,
  fetchStageHistory,
  moveDealStage,
  releaseDeal,
  updateDeal,
  updateDealProposal,
  type CreateDealPayload,
  type CreateDealProposalPayload,
  type DealFilters,
  type UpdateDealPayload,
  type UpdateDealProposalPayload,
} from "@/services/deals";
import type { Deal, DealProposal, StageHistoryEntry } from "@/data/types";
import { toast } from "@/store/useToastStore";

export const dealKeys = {
  all: ["deals"] as const,
  lists: (filters?: DealFilters) => [...dealKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...dealKeys.all, "detail", id] as const,
  proposals: (dealId: string) => [...dealKeys.all, "proposals", dealId] as const,
  stageHistory: (dealId: string) => [...dealKeys.all, "stage_history", dealId] as const,
};

function updateDealInListCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updated: Deal,
) {
  queryClient.setQueriesData<Deal[]>({ queryKey: dealKeys.all }, (old) =>
    old?.map((deal) => (deal.id === updated.id ? updated : deal)) ?? old,
  );
}

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: dealKeys.lists(filters),
    queryFn: () => fetchDeals(filters),
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: dealKeys.detail(id ?? ""),
    queryFn: () => fetchDealById(id!),
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDealPayload) => createDeal(payload),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.setQueryData(dealKeys.detail(deal.id), deal);
      qc.invalidateQueries({ queryKey: dealKeys.stageHistory(deal.id) });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDealPayload }) =>
      updateDeal(id, payload),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.setQueryData(dealKeys.detail(deal.id), deal);
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useMoveDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dealId,
      toStage,
      note,
      userId,
      lostReason,
    }: {
      dealId: string;
      toStage: Deal["stage"];
      note?: string;
      userId: string;
      lostReason?: string;
    }) => moveDealStage(dealId, toStage, note, userId, lostReason),
    onMutate: async ({ dealId, toStage, lostReason }) => {
      await qc.cancelQueries({ queryKey: dealKeys.detail(dealId) });
      await qc.cancelQueries({ queryKey: dealKeys.all });

      const previousDetail = qc.getQueryData<Deal>(dealKeys.detail(dealId));
      const previousLists = qc.getQueriesData<Deal[]>({ queryKey: dealKeys.all });
      const now = new Date().toISOString();

      const optimisticDeal = previousDetail
        ? {
            ...previousDetail,
            stage: toStage,
            lost_reason: toStage === "LOST" ? lostReason : previousDetail.lost_reason,
            closed_at:
              toStage === "WON" || toStage === "LOST" ? now : previousDetail.closed_at,
            submitted_at: toStage === "SUBMITTED" ? now : previousDetail.submitted_at,
            updated_at: now,
          }
        : undefined;

      if (optimisticDeal) {
        qc.setQueryData(dealKeys.detail(dealId), optimisticDeal);
        updateDealInListCache(qc, optimisticDeal);
      }

      return { previousDetail, previousLists };
    },
    onError: (error, vars, context) => {
      if (context?.previousDetail) {
        qc.setQueryData(dealKeys.detail(vars.dealId), context.previousDetail);
      }
      context?.previousLists?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      const raw = error instanceof Error ? error.message : "";
      const friendly = /row-level security|violates row-level/i.test(raw)
        ? "You can only change stage on deals assigned to you — claim this deal first."
        : `Couldn't update the deal: ${raw || "unknown error"}`;
      toast.error(friendly);
    },
    onSuccess: (deal) => {
      qc.setQueryData(dealKeys.detail(deal.id), deal);
      updateDealInListCache(qc, deal);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: dealKeys.detail(vars.dealId) });
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: dealKeys.stageHistory(vars.dealId) });
    },
  });
}

export function useReleaseDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dealId,
      releaserId,
      transferToId,
    }: {
      dealId: string;
      releaserId: string;
      transferToId?: string;
    }) => releaseDeal(dealId, releaserId, transferToId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useDealProposals(dealId: string | undefined) {
  return useQuery({
    queryKey: dealKeys.proposals(dealId ?? ""),
    queryFn: () => fetchDealProposals(dealId!),
    enabled: !!dealId,
  });
}

export function useCreateDealProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDealProposalPayload) => createDealProposal(payload),
    onSuccess: (proposal) => {
      qc.invalidateQueries({ queryKey: dealKeys.proposals(proposal.deal_id) });
    },
  });
}

export function useUpdateDealProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      dealId,
    }: {
      id: string;
      payload: UpdateDealProposalPayload;
      dealId: string;
    }) => updateDealProposal(id, payload).then((proposal) => ({ proposal, dealId })),
    onSuccess: ({ dealId }) => {
      qc.invalidateQueries({ queryKey: dealKeys.proposals(dealId) });
    },
  });
}

export function useDeleteDealProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dealId }: { id: string; dealId: string }) =>
      deleteDealProposal(id).then(() => dealId),
    onSuccess: (dealId) => {
      qc.invalidateQueries({ queryKey: dealKeys.proposals(dealId) });
    },
  });
}

export function useStageHistory(dealId: string | undefined) {
  return useQuery({
    queryKey: dealKeys.stageHistory(dealId ?? ""),
    queryFn: () => fetchStageHistory(dealId!),
    enabled: !!dealId,
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      contactData,
      dealData,
      userId,
    }: {
      leadId: string;
      contactData: Record<string, unknown>;
      dealData: Record<string, unknown> | null;
      userId: string;
    }) => convertLead(leadId, contactData, dealData, userId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["leads", vars.leadId] });
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
