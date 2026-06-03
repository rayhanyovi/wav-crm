import { useState } from "react";
import { ExternalLink, Plus, UserCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useContacts, useCreateContact } from "@/hooks/useContacts";
import { useDeals } from "@/hooks/useDeals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { canEdit } from "@/lib/permissions";

function ContactsTableSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-5 gap-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactsPage() {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const { data: contacts = [], isLoading: contactsLoading, error: contactsError } = useContacts();
  const { data: deals = [], isLoading: dealsLoading, error: dealsError } = useDeals();
  const createContactMutation = useCreateContact();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
  });

  const filtered = contacts.filter((contact) => {
    const name = `${contact.first_name} ${contact.last_name}`.toLowerCase();
    return (
      !search ||
      name.includes(search.toLowerCase()) ||
      contact.email?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId);
  const selectedDeals = selectedContact
    ? deals.filter((deal) => deal.contact_id === selectedContact.id && !deal.deleted_at)
    : [];

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !currentUser) return;

    await createContactMutation.mutateAsync({
      ...form,
      source: "OWN_SOURCE",
      created_by: currentUser.id,
    });

    setCreateOpen(false);
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
    });
  };

  const isLoading = contactsLoading || dealsLoading;
  const errorMessage = contactsError?.message || dealsError?.message;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contacts</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72"
        />
        {canEdit(currentUser) && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Contact
          </Button>
        )}
      </div>

      {isLoading ? (
        <ContactsTableSkeleton />
      ) : errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load contacts: {errorMessage}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No contacts found"
          action={
            canEdit(currentUser)
              ? { label: "New Contact", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Deals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => {
                const dealCount = deals.filter(
                  (deal) => deal.contact_id === contact.id && !deal.deleted_at,
                ).length;

                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <TableCell className="font-medium">
                      {contact.first_name} {contact.last_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {contact.email || "..."}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {contact.phone || "..."}
                    </TableCell>
                    <TableCell className="text-xs">{contact.title || "..."}</TableCell>
                    <TableCell className="text-xs">{dealCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContactId(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          {selectedContact && (
            <div className="space-y-5">
              <SheetHeader className="pr-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle>
                      {selectedContact.first_name} {selectedContact.last_name}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedContact.title || "Contact"}
                    </p>
                  </div>
                  <Button asChild variant="outline" title="Open detail page">
                    <Link to={`/contacts/${selectedContact.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      Details
                    </Link>
                  </Button>
                </div>
              </SheetHeader>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contact Details
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {selectedContact.email || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {selectedContact.phone || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {formatDate(selectedContact.created_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated:</span>{" "}
                    {formatDate(selectedContact.updated_at)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Deals
                </p>
                {selectedDeals.length > 0 ? (
                  selectedDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="rounded-md border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/deals/${deal.id}`}
                          className="font-medium truncate text-primary hover:underline"
                        >
                          {deal.title}
                        </Link>
                        <span className="font-semibold">
                          {formatCurrency(deal.value)}
                        </span>
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {deal.stage}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No deals for this contact.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First Name *</Label>
              <Input
                value={form.first_name}
                onChange={(event) =>
                  setForm({ ...form, first_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Last Name *</Label>
              <Input
                value={form.last_name}
                onChange={(event) =>
                  setForm({ ...form, last_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!form.first_name || !form.last_name || createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
