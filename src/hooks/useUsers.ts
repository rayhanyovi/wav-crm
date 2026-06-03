import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  fetchUserById,
  updateUser,
  fetchPendingUsers,
  approveUser,
  rejectUser,
} from "@/services/users";
import type { UpdateUserPayload } from "@/services/users";
import type { User } from "@/data/types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const userKeys = {
  all:     ["users"] as const,
  lists:   () => [...userKeys.all, "list"] as const,
  detail:  (id: string) => [...userKeys.all, "detail", id] as const,
  pending: () => [...userKeys.all, "pending"] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch all active + inactive CRM users */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn:  fetchUsers,
  });
}

/** Fetch a single user by ID */
export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ""),
    queryFn:  () => fetchUserById(id!),
    enabled:  !!id,
  });
}

/** Update a user (MASTER only — RLS enforced server-side) */
export function useUpdateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload),

    // Optimistic update
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: userKeys.lists() });
      const prev = qc.getQueryData<User[]>(userKeys.lists());

      qc.setQueryData<User[]>(userKeys.lists(), (old) =>
        old?.map((u) =>
          u.id === id
            ? {
                ...u,
                ...payload,
                avatar: payload.avatar ?? u.avatar,
                credit_balance: payload.credit_balance ?? u.credit_balance,
                telemarketer_access: payload.telemarketer_access ?? u.telemarketer_access,
                telemarketer_id: payload.telemarketer_id ?? u.telemarketer_id,
              }
            : u,
        ) ?? []
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(userKeys.lists(), ctx.prev);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

// ─── Registration approvals (MASTER only) ──────────────────────────────────────

/** Users awaiting approval. */
export function usePendingUsers() {
  return useQuery({
    queryKey: userKeys.pending(),
    queryFn:  fetchPendingUsers,
  });
}

/** Approve a pending user: assign role + activate. */
export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: User["role"] }) =>
      approveUser(id, role),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: userKeys.pending() });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/** Reject a pending user. */
export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rejectUser(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: userKeys.pending() });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
