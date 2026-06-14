import { api, type Envelope } from "@/lib/api";

export interface Script {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type CreateScriptPayload = { title: string; content: string };
export type UpdateScriptPayload = { title?: string; content?: string };

export async function fetchScripts(): Promise<Script[]> {
  const res = await api.get<Envelope<Script[]>>("/api/scripts");
  return res.data;
}

export async function createScript(payload: CreateScriptPayload): Promise<Script> {
  const res = await api.post<Envelope<Script>>("/api/scripts", payload);
  return res.data;
}

export async function updateScript(id: string, payload: UpdateScriptPayload): Promise<Script> {
  const res = await api.patch<Envelope<Script>>(`/api/scripts/${id}`, payload);
  return res.data;
}

export async function deleteScript(id: string): Promise<void> {
  await api.delete(`/api/scripts/${id}`);
}
