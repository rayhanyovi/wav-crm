import { useState } from "react";
import { Building2, ExternalLink, Plus } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { canEdit } from "@/lib/permissions";
import { Link, useNavigate } from "react-router-dom";

export function CompaniesPage() {
  const { companies, contacts, deals, createCompany } = useCrmStore();
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    name: "",
    industry: "",
    website: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const liveCompanies = companies.filter((c) => !c.deleted_at);
  const filtered = liveCompanies.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => {
    if (!form.name || !currentUser) return;
    createCompany({ ...form, created_by: currentUser.id }, currentUser.id);
    setCreateOpen(false);
    setForm({
      name: "",
      industry: "",
      website: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const selectedContacts = selectedCompany
    ? contacts.filter(
        (c) => c.company_id === selectedCompany.id && !c.deleted_at,
      )
    : [];
  const selectedDeals = selectedCompany
    ? deals.filter((d) => d.company_id === selectedCompany.id && !d.deleted_at)
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Companies</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        {canEdit(currentUser) && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Company
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies found"
          action={
            canEdit(currentUser)
              ? { label: "New Company", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Deals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((co) => {
                const contactCount = contacts.filter(
                  (c) => c.company_id === co.id && !c.deleted_at,
                ).length;
                const dealCount = deals.filter(
                  (d) => d.company_id === co.id && !d.deleted_at,
                ).length;
                return (
                  <TableRow
                    key={co.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/companies/${co.id}`)}
                  >
                    <TableCell className="font-medium">{co.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {co.industry}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {co.website || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{contactCount}</TableCell>
                    <TableCell className="text-xs">{dealCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet
        open={!!selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompanyId(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          {selectedCompany && (
            <div className="space-y-5">
              <SheetHeader className="pr-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle>{selectedCompany.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedCompany.industry || "Company"}
                    </p>
                  </div>
                  <Button asChild variant="outline" title="Open detail page">
                    <Link to={`/companies/${selectedCompany.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      Details
                    </Link>
                  </Button>
                </div>
              </SheetHeader>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Company Details
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Website:</span>{" "}
                    {selectedCompany.website || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {selectedCompany.phone || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {selectedCompany.email || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {formatDate(selectedCompany.created_at)}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address:</span>{" "}
                    {selectedCompany.address || "N/A"}
                  </div>
                </div>
                {selectedCompany.notes && (
                  <p className="text-xs text-foreground pt-1">
                    {selectedCompany.notes}
                  </p>
                )}
              </div>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contacts
                </p>
                {selectedContacts.length > 0 ? (
                  selectedContacts.slice(0, 5).map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-md border p-2 text-xs"
                    >
                      <Link
                        to={`/contacts/${contact.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {contact.first_name} {contact.last_name}
                      </Link>
                      <p className="text-muted-foreground">
                        {contact.title || "Contact"} ·{" "}
                        {contact.email || "No email"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No contacts linked to this company.
                  </p>
                )}
              </div>

              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Deals
                </p>
                {selectedDeals.length > 0 ? (
                  selectedDeals.slice(0, 5).map((deal) => (
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
                    No deals linked to this company.
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
            <DialogTitle>New Company</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Company Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Industry</Label>
              <Input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!form.name}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
