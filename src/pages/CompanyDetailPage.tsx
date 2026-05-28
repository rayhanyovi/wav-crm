import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DealStageBadge,
  LeadStatusBadge,
} from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";
import { canEdit } from "@/lib/permissions";

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companies, contacts, deals, leads, updateCompany } = useCrmStore();
  const { currentUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const company = companies.find((c) => c.id === id);
  if (!company)
    return <div className="p-6 text-muted-foreground">Company not found.</div>;

  const companyContacts = contacts.filter(
    (c) => c.company_id === id && !c.deleted_at,
  );
  const companyDeals = deals.filter(
    (d) => d.company_id === id && !d.deleted_at,
  );
  const companyLeads = leads.filter(
    (l) => l.company_id === id && !l.deleted_at,
  );

  const handleSave = () => {
    if (!currentUser) return;
    updateCompany(company.id, form, currentUser.id);
    setEditing(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/companies")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-muted-foreground text-sm">{company.industry}</p>
        </div>
        {canEdit(currentUser) &&
          (editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(true);
                setForm({
                  name: company.name,
                  industry: company.industry,
                  website: company.website || "",
                  phone: company.phone || "",
                  email: company.email || "",
                  notes: company.notes || "",
                });
              }}
            >
              Edit
            </Button>
          ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Company Info</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Industry</Label>
                <Input
                  value={form.industry || ""}
                  onChange={(e) =>
                    setForm({ ...form, industry: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Website</Label>
                <Input
                  value={form.website || ""}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">Website</span>
              <span>{company.website || "—"}</span>
              <span className="text-muted-foreground">Phone</span>
              <span>{company.phone || "—"}</span>
              <span className="text-muted-foreground">Email</span>
              <span>{company.email || "—"}</span>
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(company.created_at)}</span>
              {company.notes && (
                <>
                  <span className="text-muted-foreground col-span-2">
                    Notes
                  </span>
                  <span className="col-span-2">{company.notes}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Contacts ({companyContacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {companyContacts.map((c) => (
                <Link
                  key={c.id}
                  to={`/contacts/${c.id}`}
                  className="block text-sm hover:text-primary"
                >
                  {c.first_name} {c.last_name}{" "}
                  {c.title && (
                    <span className="text-muted-foreground">· {c.title}</span>
                  )}
                </Link>
              ))}
              {companyContacts.length === 0 && (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Deals ({companyDeals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {companyDeals.map((d) => (
                <Link
                  key={d.id}
                  to={`/deals/${d.id}`}
                  className="flex items-center justify-between text-sm hover:bg-muted px-1 rounded"
                >
                  <span className="truncate">{d.title}</span>
                  <DealStageBadge stage={d.stage} className="ml-2 shrink-0" />
                </Link>
              ))}
              {companyDeals.length === 0 && (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Leads ({companyLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {companyLeads.map((l) => (
                <Link
                  key={l.id}
                  to={`/leads/${l.id}`}
                  className="flex items-center justify-between text-sm hover:bg-muted px-1 rounded"
                >
                  <span className="truncate">
                    {l.first_name} {l.last_name}
                  </span>
                  <LeadStatusBadge
                    status={l.status}
                    className="ml-2 shrink-0"
                  />
                </Link>
              ))}
              {companyLeads.length === 0 && (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
