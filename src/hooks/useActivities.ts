import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchActivities,
  fetchActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
  fetchComments,
  addComment,
  updateComment,
  deleteComment,
} from "@/services/activities";
import type { ActivityFilters, CreateActivityPayload, UpdateActivityPayload, Comment } from "@/services/activities";
import type { Activity } from "@/data/types";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const activityKeys = {
  all:      ["activities"] as const,
  lists:    (f?: ActivityFilters) => [...activityKeys.all, "list", f ?? {}] as const,
  detail:   (id: string) => [...activityKeys.all, "detail", id] as const,
  comments: (activityId: string) => ["comments", activityId] as const,
};

// ─── Activity hooks ───────────────────────────────────────────────────────────

export function useActivities(filters?: ActivityFilters) {
  return useQuery({
    queryKey: activityKeys.lists(filters),
    queryFn:  () => fetchActivities(filters),
  });
}

export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: activityKeys.detail(id ?? ""),
    queryFn:  () => fetchActivityById(id!),
    enabled:  !!id,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateActivityPayload) => createActivity(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateActivityPayload }) =>
      updateActivity(id, payload),

    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: activityKeys.all });

      const prevDetail = qc.getQueryData<Activity>(activityKeys.detail(id));
      if (prevDetail) {
        qc.setQueryData<Activity>(activityKeys.detail(id), { ...prevDetail, ...payload });
      }

      const prevLists = qc.getQueriesData<Activity[]>({ queryKey: activityKeys.all });
      for (const [key, data] of prevLists) {
        if (Array.isArray(data)) {
          qc.setQueryData<Activity[]>(key, data.map((a) => (a.id === id ? { ...a, ...payload } : a)));
        }
      }

      return { prevDetail, prevLists };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.prevDetail) qc.setQueryData(activityKeys.detail(id), ctx.prevDetail);
      if (ctx?.prevLists) {
        for (const [key, data] of ctx.prevLists) {
          qc.setQueryData(key, data);
        }
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function useCompleteActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, result, userId }: { id: string; result: string; userId: string }) =>
      completeActivity(id, result, userId),

    onMutate: async ({ id, result }) => {
      await qc.cancelQueries({ queryKey: activityKeys.detail(id) });
      const prev = qc.getQueryData<Activity>(activityKeys.detail(id));
      if (prev) {
        qc.setQueryData<Activity>(activityKeys.detail(id), {
          ...prev,
          result: result as Activity["result"],
          completed_at: new Date().toISOString(),
        });
      }
      return { prev };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.prev) qc.setQueryData(activityKeys.detail(id), ctx.prev);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

// ─── Comment hooks ────────────────────────────────────────────────────────────

export function useComments(activityId: string | undefined) {
  return useQuery({
    queryKey: activityKeys.comments(activityId ?? ""),
    queryFn:  () => fetchComments(activityId!),
    enabled:  !!activityId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, text, createdBy }: { activityId: string; text: string; createdBy: string }) =>
      addComment(activityId, text, createdBy),

    onSuccess: (_data, { activityId }) => {
      qc.invalidateQueries({ queryKey: activityKeys.comments(activityId) });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, text, activityId }: { id: string; text: string; activityId: string }) =>
      updateComment(id, text),

    onMutate: async ({ id, text, activityId }) => {
      await qc.cancelQueries({ queryKey: activityKeys.comments(activityId) });
      const prev = qc.getQueryData<Comment[]>(activityKeys.comments(activityId));
      if (prev) {
        qc.setQueryData<Comment[]>(
          activityKeys.comments(activityId),
          prev.map((c) => (c.id === id ? { ...c, text } : c))
        );
      }
      return { prev, activityId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(activityKeys.comments(ctx.activityId), ctx.prev);
    },

    onSettled: (_data, _err, { activityId }) => {
      qc.invalidateQueries({ queryKey: activityKeys.comments(activityId) });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; activityId: string }) => deleteComment(id),

    onMutate: async ({ id, activityId }) => {
      await qc.cancelQueries({ queryKey: activityKeys.comments(activityId) });
      const prev = qc.getQueryData<Comment[]>(activityKeys.comments(activityId));
      if (prev) {
        qc.setQueryData<Comment[]>(
          activityKeys.comments(activityId),
          prev.filter((c) => c.id !== id)
        );
      }
      return { prev, activityId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(activityKeys.comments(ctx.activityId), ctx.prev);
    },

    onSettled: (_data, _err, { activityId }) => {
      qc.invalidateQueries({ queryKey: activityKeys.comments(activityId) });
    },
  });
}
