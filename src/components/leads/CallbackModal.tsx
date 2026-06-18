import { useEffect, useMemo, useState } from "react";
import { Clock, PhoneCall, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateLead } from "@/hooks/useLeads";
import { useUsers } from "@/hooks/useUsers";
import type { UpdateLeadPayload } from "@/services/leads";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import type { Lead } from "@/data/types";

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/** Format a Date as the local value a <input type="datetime-local"> expects. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function CallbackModal({ lead, open, onClose, onSaved }: Props) {
  const { currentUser } = useAuthStore();
  const updateLead = useUpdateLead();
  const { data: users = [] } = useUsers();

  const initial = lead.callback_at ? new Date(lead.callback_at) : todayAt(14, 0);
  const [when, setWhen] = useState(toLocalInput(initial));
  const [note, setNote] = useState(lead.callback_note ?? "");
  const telemarketers = useMemo(
    () =>
      users
        .filter((user) => user.is_active && user.role === "TELEMARKETER")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const defaultAssigneeId =
    lead.callback_assigned_to ??
    (currentUser?.role === "TELEMARKETER" ? currentUser.id : undefined) ??
    telemarketers[0]?.id ??
    currentUser?.id ??
    "";
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);

  useEffect(() => {
    if (!open) return;
    setWhen(toLocalInput(lead.callback_at ? new Date(lead.callback_at) : todayAt(14, 0)));
    setNote(lead.callback_note ?? "");
    setAssigneeId(defaultAssigneeId);
  }, [defaultAssigneeId, lead.callback_at, lead.callback_note, open]);

  const setPreset = (d: Date) => setWhen(toLocalInput(d));

  const save = () => {
    if (!currentUser || !when) return;
    const iso = new Date(when).toISOString();
    updateLead.mutate(
      {
        id: lead.id,
        payload: {
          callback_at: iso,
          callback_assigned_to: assigneeId || currentUser.id,
          callback_note: note.trim() || undefined,
        },
        userId: currentUser.id,
      },
      {
        onSuccess: () => {
          toast.success(`Callback set for ${new Date(iso).toLocaleString()}`);
          onClose();
          onSaved?.();
        },
        onError: (e) =>
          toast.error(`Couldn't schedule callback: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );
  };

  const clearCallback = () => {
    if (!currentUser) return;
    // Clearing requires sending explicit nulls (PATCH only writes provided keys);
    // the optional-only payload type can't express that, so cast for this call.
    const clearPayload = {
      callback_at: null,
      callback_assigned_to: null,
      callback_note: null,
    } as unknown as UpdateLeadPayload;
    updateLead.mutate(
      {
        id: lead.id,
        payload: clearPayload,
        userId: currentUser.id,
      },
      {
        onSuccess: () => {
          toast.success("Callback cleared");
          onClose();
        },
      },
    );
  };

  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Schedule callback — {lead.first_name} {lead.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setPreset(new Date(now.getTime() + 60 * 60 * 1000))}>
              In 1 hour
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setPreset(todayAt(14, 0))}>
              Today 2 PM
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setPreset(todayAt(17, 0))}>
              Today 5 PM
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => { const d = todayAt(10, 0); d.setDate(d.getDate() + 1); setPreset(d); }}
            >
              Tomorrow 10 AM
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cb-when" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Call back at
            </Label>
            <Input
              id="cb-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cb-note">Note (optional)</Label>
            <Textarea
              id="cb-note"
              rows={2}
              placeholder="e.g. Wants to discuss the retirement plan; prefers Mandarin."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {telemarketers.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cb-assignee">Assigned telemarketer</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="cb-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {telemarketers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {lead.callback_at ? (
            <Button type="button" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={clearCallback} disabled={updateLead.isPending}>
              <X className="h-4 w-4" /> Clear callback
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={save} disabled={updateLead.isPending || !when} className="gap-1.5">
              <PhoneCall className="h-4 w-4" />
              {lead.callback_at ? "Update callback" : "Schedule callback"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
