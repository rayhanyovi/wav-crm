import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DealStageBadge,
  ActivityTypeBadge,
} from "@/components/common/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/format";
import { getContactActivities } from "@/lib/selectors";
import { canEdit } from "@/lib/permissions";

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contacts, companies, deals, activities, users, updateContact } =
    useCrmStore();
  const { currentUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const contact = contacts.find((c) => c.id === id);
  if (!contact)
    return <div className="p-6 text-muted-foreground">Contact not found.</div>;

  const company = companies.find((c) => c.id === contact.company_id);
  const contactDeals = deals.filter(
    (d) => d.contact_id === id && !d.deleted_at,
  );
  const contactActivities = getContactActivities(id!, activities);

  const handleSave = () => {
    if (!currentUser) return;
    updateContact(contact.id, form, currentUser.id);
    setEditing(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contacts")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {contact.first_name} {contact.last_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {contact.title || "Contact"}
            {company && (
              <>
                {" - "}
                <Link
                  to={`/companies/${company.id}`}
                  className="text-primary hover:underline"
                >
                  {company.name}
                </Link>
              </>
            )}
          </p>
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
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                  email: contact.email || "",
                  phone: contact.phone || "",
                  title: contact.title || "",
                });
              }}
            >
              Edit
            </Button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>First Name</Label>
                    <Input
                      value={form.first_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name</Label>
                    <Input
                      value={form.last_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      value={form.email || ""}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone || ""}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Title</Label>
                    <Input
                      value={form.title || ""}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {contact.email || "..."}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  {contact.phone || "..."}
                </p>
                <p>
                  <span className="text-muted-foreground">Title:</span>{" "}
                  {contact.title || "..."}
                </p>
                <p>
                  <span className="text-muted-foreground">Source:</span>{" "}
                  {contact.source || "..."}
                </p>
                <p>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {formatDate(contact.created_at)}
                </p>
                {company && (
                  <p>
                    <span className="text-muted-foreground">Company:</span>{" "}
                    <Link
                      to={`/companies/${company.id}`}
                      className="text-primary hover:underline"
                    >
                      {company.name}
                    </Link>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Associated Deals ({contactDeals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contactDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals.</p>
            ) : (
              <div className="space-y-2">
                {contactDeals.map((d) => (
                  <Link
                    key={d.id}
                    to={`/deals/${d.id}`}
                    className="flex items-center justify-between text-sm hover:bg-muted px-1 py-1 rounded-md"
                  >
                    <span className="font-medium truncate">{d.title}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <DealStageBadge stage={d.stage} />
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(d.value)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {contactActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities.</p>
          ) : (
            <div className="space-y-2">
              {contactActivities.map((a) => {
                const creator = users.find((u) => u.id === a.created_by);
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <ActivityTypeBadge
                      type={a.type}
                      className="shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{a.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {creator ? (
                          <Link
                            to={`/team/${creator.id}`}
                            className="text-primary hover:underline"
                          >
                            {creator.name}
                          </Link>
                        ) : (
                          "System"
                        )}{" "}
                        - {formatDate(a.completed_at || a.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
