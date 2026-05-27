import { useState } from "react";
import { Plus, TrendingUp, GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DealStageBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { canEdit } from "@/lib/permissions";
import { Link, useNavigate } from "react-router-dom";
import type { Deal, DealStage } from "@/data/types";
import { cn } from "@/lib/utils";

const STAGES: DealStage[] = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

const STAGE_COLORS: Record<DealStage, string> = {
  LEAD: "border-t-gray-400",
  QUALIFIED: "border-t-blue-400",
  PROPOSAL: "border-t-yellow-400",
  NEGOTIATION: "border-t-orange-400",
  CLOSED_WON: "border-t-green-400",
  CLOSED_LOST: "border-t-red-400",
};

export function DealsPage() {
  const { deals, contacts, companies, users, createDeal, moveDealStage } =
    useCrmStore();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [lostReasonDeal, setLostReasonDeal] = useState<{
    dealId: string;
    stage: DealStage;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const [form, setForm] = useState({
    title: "",
    value: "",
    contact_id: "",
    stage: "LEAD" as DealStage,
    expected_close_date: "",
  });

  const liveDeals = deals.filter((d) => !d.deleted_at);
  const filtered = liveDeals.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filterStage !== "ALL" && d.stage !== filterStage) return false;
    return true;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const toStage = over.id as DealStage;
    if (!STAGES.includes(toStage)) return;
    const deal = deals.find((d) => d.id === active.id);
    if (!deal || deal.stage === toStage) return;
    if (toStage === "CLOSED_LOST") {
      setLostReasonDeal({ dealId: deal.id, stage: toStage });
      return;
    }
    if (currentUser) moveDealStage(deal.id, toStage, undefined, currentUser.id);
  };

  const handleConfirmLost = () => {
    if (!lostReasonDeal || !currentUser) return;
    moveDealStage(
      lostReasonDeal.dealId,
      "CLOSED_LOST",
      undefined,
      currentUser.id,
      lostReason,
    );
    setLostReasonDeal(null);
    setLostReason("");
  };

  const handleCreate = () => {
    if (!form.title || !form.contact_id || !currentUser) return;
    createDeal(
      {
        title: form.title,
        value: parseFloat(form.value) || 0,
        stage: form.stage,
        contact_id: form.contact_id,
        company_id: contacts.find((c) => c.id === form.contact_id)?.company_id,
        assigned_to_id: currentUser.id,
        expected_close_date: form.expected_close_date || undefined,
        created_by: currentUser.id,
      },
      currentUser.id,
    );
    setCreateOpen(false);
    setForm({
      title: "",
      value: "",
      contact_id: "",
      stage: "LEAD",
      expected_close_date: "",
    });
  };

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Deals</h1>

      <Tabs defaultValue="table">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52"
            />
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Stages</SelectItem>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit(currentUser) && (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Deal
              </Button>
            )}
          </div>
        </div>

        {/* Table view */}
        <TabsContent value="table">
          {filtered.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No deals found"
              action={
                canEdit(currentUser)
                  ? { label: "New Deal", onClick: () => setCreateOpen(true) }
                  : undefined
              }
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Expected Close</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const contact = contacts.find((c) => c.id === d.contact_id);
                    const company = companies.find(
                      (c) => c.id === d.company_id,
                    );
                    const assignee = users.find(
                      (u) => u.id === d.assigned_to_id,
                    );
                    return (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/deals/${d.id}`)}
                      >
                        <TableCell className="font-medium">{d.title}</TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(d.value)}
                        </TableCell>
                        <TableCell>
                          <DealStageBadge stage={d.stage} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {contact ? (
                            <Link
                              to={`/contacts/${contact.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="font-medium text-primary hover:underline"
                            >
                              {contact.first_name} {contact.last_name}
                            </Link>
                          ) : (
                            "..."
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {company ? (
                            <Link
                              to={`/companies/${company.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="font-medium text-primary hover:underline"
                            >
                              {company.name}
                            </Link>
                          ) : (
                            "..."
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {assignee ? (
                            <Link
                              to={`/team/${assignee.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="font-medium text-primary hover:underline"
                            >
                              {assignee.name}
                            </Link>
                          ) : (
                            "..."
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(d.expected_close_date)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Kanban view */}
        <TabsContent value="kanban">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 overflow-x-auto pb-4">
              {STAGES.map((stage) => {
                const stageDeals = liveDeals.filter((d) => d.stage === stage);
                const total = stageDeals.reduce((s, d) => s + d.value, 0);
                return (
                  <KanbanColumn
                    key={stage}
                    stage={stage}
                    deals={stageDeals}
                    total={total}
                    contacts={contacts}
                    companies={companies}
                    nowMs={nowMs}
                    onCardClick={(id) => navigate(`/deals/${id}`)}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {activeDeal && (
                <div className="bg-card border rounded-lg p-3 shadow-lg w-56 opacity-90 text-sm font-medium">
                  {activeDeal.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Acme Corp â€“ Paket Premium"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Value (IDR)</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Stage</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) =>
                    setForm({ ...form, stage: v as DealStage })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.slice(0, 4).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Contact *</Label>
              <Select
                value={form.contact_id}
                onValueChange={(v) => setForm({ ...form, contact_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    .filter((c) => !c.deleted_at)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Expected Close</Label>
              <Input
                type="date"
                value={form.expected_close_date}
                onChange={(e) =>
                  setForm({ ...form, expected_close_date: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.title || !form.contact_id}
            >
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost reason dialog */}
      <Dialog
        open={!!lostReasonDeal}
        onOpenChange={(o) => !o && setLostReasonDeal(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Closed Lost</DialogTitle>
            <DialogDescription>
              Please provide a reason for closing this deal as lost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Client chose a competitor..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostReasonDeal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLost}
              disabled={!lostReason.trim()}
            >
              Confirm Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Kanban column
function KanbanColumn({
  stage,
  deals,
  total,
  contacts,
  companies,
  nowMs,
  onCardClick,
}: {
  stage: DealStage;
  deals: Deal[];
  total: number;
  contacts: import("@/data/types").Contact[];
  companies: import("@/data/types").Company[];
  nowMs: number;
  onCardClick: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-60 flex flex-col rounded-lg border bg-muted/30 transition-colors",
        isOver && "ring-2 ring-primary/50 bg-primary/5",
      )}
    >
      <div
        className={cn(
          "px-3 py-2 border-b border-t-2 rounded-t-lg",
          STAGE_COLORS[stage],
        )}
      >
        <div className="flex items-center justify-between">
          <DealStageBadge stage={stage} />
          <span className="text-xs font-medium">{deals.length}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(total)}
        </p>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-24">
        {deals.map((d) => (
          <KanbanCard
            key={d.id}
            deal={d}
            contacts={contacts}
            companies={companies}
            nowMs={nowMs}
            onClick={() => onCardClick(d.id)}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  deal,
  contacts,
  companies,
  nowMs,
  onClick,
}: {
  deal: Deal;
  contacts: import("@/data/types").Contact[];
  companies: import("@/data/types").Company[];
  nowMs: number;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id });
  const contact = contacts.find((c) => c.id === deal.contact_id);
  const company = companies.find((c) => c.id === deal.company_id);
  const days = Math.floor(
    (nowMs - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "bg-card border rounded-lg p-3 text-xs shadow-sm cursor-pointer group",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <div
          {...listeners}
          className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <p className="font-medium leading-snug truncate">{deal.title}</p>
          <p className="text-muted-foreground mt-0.5">
            {formatCurrency(deal.value)}
          </p>
          {contact && (
            <Link
              to={`/contacts/${contact.id}`}
              onClick={(event) => event.stopPropagation()}
              className="block text-primary hover:underline truncate"
            >
              {contact.first_name} {contact.last_name}
            </Link>
          )}
          {company && (
            <Link
              to={`/companies/${company.id}`}
              onClick={(event) => event.stopPropagation()}
              className="block text-primary hover:underline truncate"
            >
              {company.name}
            </Link>
          )}
          <p
            className={cn(
              "mt-1",
              days > 7 ? "text-orange-500" : "text-muted-foreground",
            )}
          >
            {days}d ago
          </p>
        </div>
      </div>
    </div>
  );
}
