import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addContactNote,
  createContact,
  deleteContact,
  deleteContactNote,
  fetchContactById,
  fetchContactNotes,
  fetchContacts,
  updateContact,
  type ContactFilters,
  type CreateContactPayload,
  type UpdateContactPayload,
} from "@/services/contacts";
import type { Contact, ContactNote } from "@/data/types";

export const contactKeys = {
  all: ["contacts"] as const,
  lists: (filters?: ContactFilters) => [...contactKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
  notes: (contactId: string) => [...contactKeys.all, "notes", contactId] as const,
};

export function useContacts(filters?: ContactFilters) {
  return useQuery({
    queryKey: contactKeys.lists(filters),
    queryFn: () => fetchContacts(filters),
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: contactKeys.detail(id ?? ""),
    queryFn: () => fetchContactById(id!),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContactPayload) => createContact(payload),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      qc.setQueryData(contactKeys.detail(contact.id), contact);
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateContactPayload }) =>
      updateContact(id, payload),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      qc.setQueryData(contactKeys.detail(contact.id), contact);
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useContactNotes(contactId: string | undefined) {
  return useQuery({
    queryKey: contactKeys.notes(contactId ?? ""),
    queryFn: () => fetchContactNotes(contactId!),
    enabled: !!contactId,
  });
}

export function useAddContactNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      content,
      userId,
    }: {
      contactId: string;
      content: string;
      userId: string;
    }) => addContactNote(contactId, content, userId),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: contactKeys.notes(note.contact_id) });
    },
  });
}

export function useDeleteContactNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, contactId }: { id: string; contactId: string }) =>
      deleteContactNote(id).then(() => contactId),
    onMutate: async ({ id, contactId }) => {
      await qc.cancelQueries({ queryKey: contactKeys.notes(contactId) });
      const previous = qc.getQueryData<ContactNote[]>(contactKeys.notes(contactId));
      qc.setQueryData<ContactNote[]>(
        contactKeys.notes(contactId),
        (old) => old?.filter((note) => note.id !== id) ?? [],
      );
      return { previous, contactId };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(contactKeys.notes(context.contactId), context.previous);
      }
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: contactKeys.notes(vars.contactId) });
    },
  });
}
