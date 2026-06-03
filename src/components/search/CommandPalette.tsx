import { useEffect, useState } from "react";
import { Search, UserCheck, Users, TrendingUp } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useLeads } from "@/hooks/useLeads";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  type: string;
  href: string;
  icon: React.ElementType;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const { contacts, deals } = useCrmStore();
  const { data: leads = [] } = useLeads({ includeAbandoned: true });
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  if (q.length >= 1) {
    contacts.filter((c) => !c.deleted_at && `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)).slice(0, 3).forEach((c) => {
      results.push({ id: c.id, label: `${c.first_name} ${c.last_name}`, sub: c.title || "Contact", type: "Contact", href: `/contacts/${c.id}`, icon: UserCheck });
    });
    leads.filter((l) => !l.deleted_at && `${l.first_name} ${l.last_name}`.toLowerCase().includes(q)).slice(0, 3).forEach((l) => {
      results.push({ id: l.id, label: `${l.first_name} ${l.last_name}`, sub: l.status, type: "Lead", href: `/leads/${l.id}`, icon: Users });
    });
    deals.filter((d) => !d.deleted_at && d.title.toLowerCase().includes(q)).slice(0, 3).forEach((d) => {
      results.push({ id: d.id, label: d.title, sub: d.stage, type: "Deal", href: `/deals/${d.id}`, icon: TrendingUp });
    });
  }

  const handleSelect = (href: string) => {
    navigate(href);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, leads, deals..."
            className="border-0 shadow-none focus-visible:ring-0 h-12 text-sm"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && q.length > 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results for "{query}"</div>
          )}
          {results.length === 0 && q.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Start typing to search…</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.href)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
              )}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted shrink-0">
                <r.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.type} · {r.sub}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex gap-4">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
