import { useState } from "react";
import { Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { getLeadsForCampaign } from "@/lib/selectors";
import { CampaignStatusBadge } from "@/components/common/StatusBadge";

interface StartCallingModalProps {
  open: boolean;
  onClose: () => void;
}

export function StartCallingModal({ open, onClose }: StartCallingModalProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const { campaigns, leads, activities } = useCrmStore();
  const { currentUser } = useAuthStore();
  const { startSession } = useCallSessionStore();

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const queueLeads = selectedCampaignId
    ? getLeadsForCampaign(leads, selectedCampaignId, currentUser?.id || "", activities)
    : [];

  const handleStart = () => {
    if (!selectedCampaign || queueLeads.length === 0) return;
    startSession(selectedCampaign, queueLeads);
    onClose();
    setSelectedCampaignId("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Start Calling Session
          </DialogTitle>
          <DialogDescription>
            Select a campaign to start. The system will queue your assigned leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Select active campaign…" />
              </SelectTrigger>
              <SelectContent>
                {activeCampaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      {c.name}
                      <CampaignStatusBadge status={c.status} />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCampaign && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-medium">{selectedCampaign.name}</p>
              <p className="text-muted-foreground text-xs">{selectedCampaign.description}</p>
              <p className="mt-2 text-foreground">
                <span className="font-medium">{queueLeads.length}</span>{" "}
                {queueLeads.length === 1 ? "lead" : "leads"} in queue
              </p>
              {queueLeads.length === 0 && (
                <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                  No uncontacted leads assigned to you for this campaign.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleStart}
            disabled={!selectedCampaignId || queueLeads.length === 0}
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            Start Session ({queueLeads.length} leads)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
