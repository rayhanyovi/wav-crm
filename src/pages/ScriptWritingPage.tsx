import { useState } from "react";
import { Plus, Pencil, Trash2, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useScripts, useCreateScript, useUpdateScript, useDeleteScript } from "@/hooks/useScripts";
import type { Script } from "@/services/scripts";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/store/useAuthStore";
import { canManage } from "@/lib/permissions";

export function ScriptWritingPage() {
  const { currentUser } = useAuthStore();
  const isMaster = canManage(currentUser);

  const { data: scripts = [], isLoading } = useScripts();

  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });

  const createMutation = useCreateScript();
  const updateMutation = useUpdateScript();
  const deleteMutation = useDeleteScript();

  const openNew = () => {
    setForm({ title: "", content: "" });
    setSelectedScript(null);
    setDialogOpen(true);
  };

  const openEdit = (script: Script) => {
    setForm({ title: script.title, content: script.content });
    setSelectedScript(script);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (selectedScript) {
      updateMutation.mutate(
        { id: selectedScript.id, payload: { title: form.title, content: form.content } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createMutation.mutate(
        { title: form.title, content: form.content },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scripts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Call scripts and talking points for the team
          </p>
        </div>
        {isMaster && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Script
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading scripts…</div>
      ) : scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No scripts yet.</p>
          {isMaster && (
            <Button variant="outline" onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first script
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-w-3xl">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="rounded-lg border bg-card p-4 flex items-start gap-4 hover:shadow-sm transition-shadow"
            >
              <div className="rounded-md bg-muted p-2 mt-0.5 shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{script.title}</p>
                {script.content && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {script.content}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  Updated {formatDate(script.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isMaster && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(script)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(script)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedScript ? "Edit Script" : "New Script"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g. Cold Call Opener"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Script Content</label>
              <Textarea
                placeholder="Write the script here…"
                rows={14}
                className="resize-none font-mono text-sm"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || isSaving}>
              {isSaving ? "Saving…" : "Save Script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete script?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleteTarget?.title}" will be permanently removed. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
