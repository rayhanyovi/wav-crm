import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, GitMerge } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadStatusBadge } from "@/components/common/StatusBadge";
import { useMergeDuplicateLeads } from "@/hooks/useLeads";
import { formatDate } from "@/lib/format";
import { toast } from "@/store/useToastStore";
import type { Lead } from "@/data/types";

interface Props {
  leads: Lead[];
  open: boolean;
  onClose: () => void;
  onMerged: () => void;
}

function phoneKey(phone: string | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function touchScore(lead: Lead): number {
  let score = 0;
  if (lead.status !== "NA") score += 4;
  if (lead.notes?.trim()) score += 2;
  if (lead.appointment_date || lead.appointment_time || lead.appointment_result) score += 4;
  if (lead.callback_at || lead.callback_note) score += 3;
  if (lead.assigned_to_id || lead.telemarketer_owner_id || lead.adviser_owner_id) score += 2;
  if (lead.converted_contact_id || lead.converted_at) score += 5;
  if (lead.last_contacted_at) score += 2;
  if (lead.fact_find_done || lead.fact_find_notes) score += 2;
  return score;
}

function recommendedLeadId(leads: Lead[]): string {
  const ranked = [...leads].sort((a, b) => {
    const scoreDiff = touchScore(b) - touchScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return ranked[0]?.id ?? "";
}

export function MergeDuplicatesDialog({ leads, open, onClose, onMerged }: Props) {
  const mergeDuplicates = useMergeDuplicateLeads();
  const [targetId, setTargetId] = useState("");

  const phoneKeys = useMemo(() => Array.from(new Set(leads.map((lead) => phoneKey(lead.phone)))), [leads]);
  const mergeablePhone = phoneKeys.length === 1 && phoneKeys[0].length >= 6;
  const canMerge = leads.length >= 2 && mergeablePhone && Boolean(targetId);
  const targetLead = leads.find((lead) => lead.id === targetId);
  const sourceIds = leads.filter((lead) => lead.id !== targetId).map((lead) => lead.id);

  useEffect(() => {
    if (!open) return;
    setTargetId(recommendedLeadId(leads));
  }, [leads, open]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !mergeDuplicates.isPending) onClose();
  };

  const runMerge = () => {
    if (!canMerge) return;
    mergeDuplicates.mutate(
      { targetId, sourceIds },
      {
        onSuccess: (result) => {
          toast.success(
            `Merged ${result.merged_source_ids.length} duplicate${result.merged_source_ids.length === 1 ? "" : "s"} into ${result.lead.first_name} ${result.lead.last_name}.`,
          );
          onMerged();
          onClose();
        },
        onError: (error) =>
          toast.error(`Merge failed: ${error instanceof Error ? error.message : "unknown error"}`),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge duplicate leads
          </DialogTitle>
          <DialogDescription>
            Keep one lead, move its notes, history, activities, deals, and linked credit records, then remove the duplicate rows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!mergeablePhone && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Select at least two leads with the same phone number before merging.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Lead to keep</Label>
            <Select value={targetId} onValueChange={setTargetId} disabled={!mergeablePhone}>
              <SelectTrigger>
                <SelectValue placeholder="Choose the lead to keep" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.first_name} {lead.last_name} - {lead.phone || "no phone"} - score {touchScore(lead)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetLead && (
              <p className="text-xs text-muted-foreground">
                Keeping {targetLead.first_name} {targetLead.last_name}; {sourceIds.length} duplicate{sourceIds.length === 1 ? "" : "s"} will be merged and removed.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Selected leads</p>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className={`grid grid-cols-[1fr_auto] gap-3 border-b px-3 py-2 text-sm last:border-b-0 ${
                    lead.id === targetId ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <LeadStatusBadge status={lead.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{lead.phone || "No phone"}</span>
                      <span>Created {formatDate(lead.created_at)}</span>
                      {lead.last_contacted_at && <span>Last call {formatDate(lead.last_contacted_at)}</span>}
                    </div>
                  </div>
                  <span className="self-start rounded bg-muted px-1.5 py-0.5 text-xs">
                    {lead.id === targetId ? "keep" : "merge"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mergeDuplicates.isPending}>
            Cancel
          </Button>
          <Button onClick={runMerge} disabled={!canMerge || mergeDuplicates.isPending} className="gap-2">
            <GitMerge className="h-4 w-4" />
            {mergeDuplicates.isPending ? "Merging..." : "Merge duplicates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
