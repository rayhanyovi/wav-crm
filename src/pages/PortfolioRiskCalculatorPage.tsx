import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Plus, Trash2, Search, AlertCircle, ChevronDown, BookOpen, PlusCircle, Check, Banknote, Copy, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  SGA_FUNDS,
  getRiskCategory,
  RISK_CATEGORY_COLOR,
  RISK_CATEGORY_BAR,
  type SgaFund,
  type RiskCategory,
} from "@/data/sgaFunds";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PortfolioLine {
  id: string;
  fund: SgaFund | null;
  allocation: number; // 0–100
}

// ── Risk Matrix display data ──────────────────────────────────────────────────
const MATRIX_ROWS = [
  { label: 'Equity', ratings: [9, 10, 11, 12] },
  { label: 'Mixed', ratings: [5, 6, 7, 8] },
  { label: 'Bond', ratings: [1, 2, 3, 4] },
];
const MATRIX_COLS = ['Diversified', 'Regional', 'Sector', 'Country'];

const MATRIX_BG: Record<number, string> = {
  1: 'bg-green-500', 2: 'bg-green-400', 3: 'bg-green-300',
  4: 'bg-yellow-300', 5: 'bg-yellow-200',
  6: 'bg-blue-300', 7: 'bg-blue-200', 8: 'bg-blue-100',
  9: 'bg-orange-300',
  10: 'bg-red-400', 11: 'bg-red-500', 12: 'bg-red-600',
};

// ── Fund Search Combobox (portal dropdown to escape overflow:hidden) ──────────
function FundCombobox({
  value,
  onChange,
}: {
  value: SgaFund | null;
  onChange: (f: SgaFund | null) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value?.name ?? ""); }, [value]);

  // Reposition dropdown to align with the input
  const updatePosition = useCallback(() => {
    if (!inputWrapRef.current) return;
    const rect = inputWrapRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 420),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SGA_FUNDS.slice(0, 12);
    return SGA_FUNDS.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.manager.toLowerCase().includes(q) ||
      f.sgaClass.toLowerCase().includes(q) ||
      f.isin.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query]);

  const dropdown = open && createPortal(
    <div
      style={dropdownStyle}
      className="bg-popover border rounded-md shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Results */}
      <div className="overflow-y-auto max-h-52">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No funds match</p>
        ) : (
          filtered.map((f) => (
            <button
              key={f.isin + f.name}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(f);
                setQuery(f.name);
                setOpen(false);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.manager} · {f.sgaClass}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RISK_CATEGORY_COLOR[f.riskCategory]}`}>
                    {f.riskRating}
                  </span>
                  {f.dividendYield !== null && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                      <Banknote className="h-2.5 w-2.5" />{f.dividendYield.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={inputWrapRef} className="relative flex-1 min-w-0">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); updatePosition(); }}
        onFocus={() => { setOpen(true); updatePosition(); }}
        placeholder="Search fund name, manager, or ISIN…"
        className="pl-8 h-8 text-xs"
      />
      {dropdown}
    </div>
  );
}

// ── Fund Browser Modal ────────────────────────────────────────────────────────
const ASSET_OPTIONS = ['Equity', 'Mixed Assets', 'Bond'] as const;
const RISK_OPTIONS: RiskCategory[] = ['Conservative', 'Moderate', 'Balanced', 'Growth', 'Aggressive'];
const RATING_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12];

function FundBrowserModal({
  open,
  onClose,
  addedKeys,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  addedKeys: Set<string>;
  onAdd: (fund: SgaFund) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterAsset, setFilterAsset] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<RiskCategory | null>(null);
  const [filterRatings, setFilterRatings] = useState<number[]>([]);
  const [filterDividend, setFilterDividend] = useState<boolean>(false);

  const toggleRating = (r: number) =>
    setFilterRatings((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SGA_FUNDS.filter((f) => {
      if (filterAsset && f.assetClass !== filterAsset) return false;
      if (filterRisk && f.riskCategory !== filterRisk) return false;
      if (filterRatings.length > 0 && !filterRatings.includes(f.riskRating)) return false;
      if (filterDividend && f.dividendYield === null) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.manager.toLowerCase().includes(q) ||
        f.sgaClass.toLowerCase().includes(q) ||
        f.isin.toLowerCase().includes(q)
      );
    });
  }, [search, filterAsset, filterRisk, filterRatings, filterDividend]);

  const hasFilters = !!(search || filterAsset || filterRisk || filterRatings.length || filterDividend);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl h-[82vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>Fund Browser</DialogTitle>
          <p className="text-xs text-muted-foreground">Browse funds and add to your portfolio — {filtered.length} fund{filtered.length !== 1 ? 's' : ''} shown</p>
        </DialogHeader>

        {/* Filters */}
        <div className="px-5 py-3 border-b shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, manager, ISIN, or SGA class…"
              className="pl-8 h-8 text-xs" autoFocus />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* Asset */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground">Asset</span>
              {ASSET_OPTIONS.map((a) => (
                <button key={a} onClick={() => setFilterAsset(filterAsset === a ? null : a)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filterAsset === a ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:bg-muted'}`}>
                  {a}
                </button>
              ))}
            </div>
            {/* Category */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground">Category</span>
              {RISK_OPTIONS.map((r) => (
                <button key={r} onClick={() => setFilterRisk(filterRisk === r ? null : r)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${filterRisk === r ? RISK_CATEGORY_COLOR[r] : 'text-muted-foreground border-border hover:bg-muted'}`}>
                  {r}
                </button>
              ))}
            </div>
            {/* Rating */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground mr-0.5">Rating</span>
              {RATING_OPTIONS.map((r) => (
                <button key={r} onClick={() => toggleRating(r)}
                  className={`text-[10px] w-6 h-6 rounded border font-bold transition-colors ${filterRatings.includes(r) ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:bg-muted'}`}>
                  {r}
                </button>
              ))}
            </div>
            {/* Dividend */}
            <button
              onClick={() => setFilterDividend((v) => !v)}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors shrink-0 ${
                filterDividend
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <Banknote className="h-3 w-3" />
              Has Dividend
            </button>
            {hasFilters && (
              <button onClick={() => { setSearch(''); setFilterAsset(null); setFilterRisk(null); setFilterRatings([]); setFilterDividend(false); }}
                className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fund Name</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Manager</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">SGA Class</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Dividend</th>
                <th className="px-3 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-muted-foreground">No funds match your filters</td></tr>
              ) : filtered.map((f) => {
                const key = f.isin + f.name;
                const added = addedKeys.has(key);
                return (
                  <tr key={key} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium leading-snug">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{f.isin} · {f.currency}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{f.manager}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell text-[11px]">{f.sgaClass}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${RISK_CATEGORY_COLOR[f.riskCategory]}`}>
                        {f.riskCategory.slice(0,4)}. {f.riskRating}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                      {f.dividendYield !== null ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {f.dividendYield.toFixed(2)}% p.a.
                          </span>
                          {f.dividendFrequency && (
                            <span className="text-[9px] text-muted-foreground">{f.dividendFrequency}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant={added ? 'ghost' : 'outline'} className="h-7 text-xs gap-1"
                        disabled={added} onClick={() => onAdd(f)}>
                        {added ? <><Check className="h-3 w-3" />Added</> : <><PlusCircle className="h-3 w-3" />Add</>}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Risk Gauge Bar ────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const pct = ((score - 1) / 11) * 100;
  const category = getRiskCategory(score);
  return (
    <div className="space-y-1.5">
      <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-green-400 via-yellow-300 via-blue-400 via-orange-400 to-red-600">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-2 rounded-full bg-white border-2 border-gray-800 shadow-md transition-all duration-500"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>Conservative</span>
        <span>Moderate</span>
        <span>Balanced</span>
        <span>Growth</span>
        <span>Aggressive</span>
      </div>
      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold border ${RISK_CATEGORY_COLOR[category]}`}>
        <span className={`h-2 w-2 rounded-full ${RISK_CATEGORY_BAR[category]}`} />
        {category}
      </div>
    </div>
  );
}

// ── Copy Summary Card ────────────────────────────────────────────────────────
const PROFILE_OPTIONS: RiskCategory[] = ['Conservative', 'Moderate', 'Balanced', 'Growth', 'Aggressive'];

function CopySummaryCard({
  filledLines,
  resultCategory,
  clientProfile,
  onClientProfileChange,
  copied,
  onCopy,
}: {
  filledLines: PortfolioLine[];
  resultCategory: RiskCategory;
  clientProfile: RiskCategory | '';
  onClientProfileChange: (v: RiskCategory | '') => void;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-3 py-2.5 bg-muted/50 border-b flex items-center justify-between">
        <span className="text-xs font-medium">Client Summary</span>
        <Button
          size="sm"
          variant={copied ? "ghost" : "outline"}
          className="h-7 text-xs gap-1.5"
          onClick={onCopy}
        >
          {copied ? <><CheckCheck className="h-3 w-3 text-green-600" />Copied!</> : <><Copy className="h-3 w-3" />Copy</>}
        </Button>
      </div>
      <div className="p-3 space-y-3">
        {/* Preview */}
        <div className="rounded-md bg-muted/30 border p-3 text-xs leading-relaxed space-y-2 font-mono">
          <p className="text-muted-foreground">Funds available were shown and you have selected the following:</p>
          <div className="space-y-0.5">
            {filledLines.map((l, i) => (
              <p key={l.id}>
                {i + 1}.&nbsp;&nbsp;🟦{l.fund!.name}, {l.allocation}% {l.fund!.riskCategory}🟦
              </p>
            ))}
          </div>
          <p className="pt-1">
            The overall risk classification of the funds selected by you is 🟦{resultCategory}🟦.
          </p>
          {clientProfile && (
            <p>
              Your risk profile is 🟦{clientProfile}🟦.
            </p>
          )}
        </div>

        {/* Client profile selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Client's risk profile:</span>
          <div className="flex gap-1">
            {PROFILE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => onClientProfileChange(clientProfile === opt ? '' : opt)}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  clientProfile === opt
                    ? RISK_CATEGORY_COLOR[opt]
                    : 'text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
let nextId = 1;
function makeId() { return String(nextId++); }

const EMPTY_LINE = (): PortfolioLine => ({ id: makeId(), fund: null, allocation: 0 });

export function PortfolioRiskCalculatorPage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<PortfolioLine[]>([EMPTY_LINE(), EMPTY_LINE()]);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clientProfile, setClientProfile] = useState<RiskCategory | ''>('');

  // ── Derived calculations ──────────────────────────────────────────────────
  const filledLines = lines.filter((l) => l.fund !== null);
  const totalAlloc = lines.reduce((s, l) => s + (l.allocation || 0), 0);
  const allocError = Math.abs(totalAlloc - 100) > 0.01 && filledLines.length > 0;

  const weightedScore = useMemo(() => {
    if (filledLines.length === 0) return null;
    const totalWeight = filledLines.reduce((s, l) => s + l.allocation, 0);
    if (totalWeight === 0) return null;
    const sum = filledLines.reduce((s, l) => s + l.fund!.riskRating * l.allocation, 0);
    return sum / totalWeight;
  }, [filledLines]);

  const resultCategory: RiskCategory | null = weightedScore !== null ? getRiskCategory(weightedScore) : null;

  // ── Breakdown by asset class ───────────────────────────────────────────────
  const breakdown = useMemo(() => {
    const map: Record<string, { totalAlloc: number; totalWeighted: number }> = {};
    filledLines.forEach((l) => {
      const k = l.fund!.assetClass;
      if (!map[k]) map[k] = { totalAlloc: 0, totalWeighted: 0 };
      map[k].totalAlloc += l.allocation;
      map[k].totalWeighted += l.fund!.riskRating * l.allocation;
    });
    return Object.entries(map).map(([cls, v]) => ({
      assetClass: cls,
      allocation: v.totalAlloc,
      avgRating: v.totalAlloc > 0 ? v.totalWeighted / v.totalAlloc : 0,
    }));
  }, [filledLines]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const updateLine = (id: string, patch: Partial<PortfolioLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const addLine = () => setLines((prev) => [...prev, EMPTY_LINE()]);

  const distributeEvenly = () => {
    const filled = lines.filter((l) => l.fund);
    if (filled.length === 0) return;
    const each = parseFloat((100 / filled.length).toFixed(2));
    const remainder = parseFloat((100 - each * filled.length).toFixed(2));
    setLines((prev) =>
      prev.map((l, i) => {
        const filledIdx = filled.findIndex((f) => f.id === l.id);
        if (filledIdx === -1) return l;
        const alloc = filledIdx === 0 ? each + remainder : each;
        return { ...l, allocation: alloc };
      })
    );
  };

  const clearAll = () => setLines([EMPTY_LINE(), EMPTY_LINE()]);

  // Keys of funds already in the calculator (to show "Added" state in modal)
  const addedKeys = useMemo(
    () => new Set(lines.filter((l) => l.fund).map((l) => l.fund!.isin + l.fund!.name)),
    [lines],
  );

  // Called from modal: fill the first empty slot, or append a new row
  const handleBrowserAdd = (fund: SgaFund) => {
    setLines((prev) => {
      const emptyIdx = prev.findIndex((l) => !l.fund);
      if (emptyIdx !== -1) {
        return prev.map((l, i) => i === emptyIdx ? { ...l, fund } : l);
      }
      return [...prev, { id: makeId(), fund, allocation: 0 }];
    });
  };

  return (
    <div className="p-6 mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/tools")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Portfolio Risk Calculator</h1>
          <p className="text-xs text-muted-foreground">Weighted average risk rating based on SGA Fund Risk Matrix</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Fund Input ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Fund rows */}
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_80px_32px] gap-2 px-3 py-2 bg-muted/50 border-b">
              <span className="text-xs font-medium text-muted-foreground">Fund</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Risk</span>
              <span className="text-xs font-medium text-muted-foreground text-right">Allocation %</span>
              <span />
            </div>

            <div className="divide-y">
              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-[1fr_90px_80px_32px] gap-2 items-center px-3 py-2">
                  {/* Fund picker */}
                  <FundCombobox
                    value={line.fund}
                    onChange={(f) => updateLine(line.id, { fund: f })}
                  />

                  {/* Risk badge */}
                  <div className="flex justify-center">
                    {line.fund ? (
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${RISK_CATEGORY_COLOR[line.fund.riskCategory]}`}>
                        {line.fund.riskCategory.slice(0, 4)}. {line.fund.riskRating}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Allocation input */}
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={line.allocation || ""}
                      onChange={(e) =>
                        updateLine(line.id, { allocation: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0"
                      className="h-8 text-xs pr-5 text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                  </div>

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t">
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={addLine}>
                  <Plus className="h-3 w-3" /> Add Fund
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowBrowser(true)}>
                  <BookOpen className="h-3 w-3" /> View All Funds
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={distributeEvenly} disabled={filledLines.length === 0}>
                  Distribute evenly
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={clearAll}>
                  Clear
                </Button>
              </div>
              <div className={`text-xs font-medium tabular-nums ${allocError ? "text-destructive" : totalAlloc === 100 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                Total: {totalAlloc.toFixed(1)}%
              </div>
            </div>
          </div>

          {allocError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Allocations must sum to 100% — currently {totalAlloc.toFixed(1)}%
            </div>
          )}

          {/* Breakdown by asset class */}
          {breakdown.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <span className="text-xs font-medium">Breakdown by Asset Class</span>
              </div>
              <div className="divide-y">
                {breakdown.map((b) => (
                  <div key={b.assetClass} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xs w-24 shrink-0">{b.assetClass}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(b.allocation, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-10 text-right">{b.allocation.toFixed(1)}%</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border w-20 text-center ${RISK_CATEGORY_COLOR[getRiskCategory(b.avgRating)]}`}>
                      Avg. {b.avgRating.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Result panel ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Score card */}
          <div className="rounded-lg border p-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Portfolio Risk Score</p>

            {weightedScore !== null && !allocError ? (
              <>
                <div className="text-center">
                  <span className="text-6xl font-bold tabular-nums">{weightedScore.toFixed(1)}</span>
                  <span className="text-xl text-muted-foreground"> / 12</span>
                </div>
                <RiskGauge score={weightedScore} />
                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                  <p className="font-medium text-foreground">Formula</p>
                  <p>∑ (Fund Risk Rating × Allocation%) ÷ Total Allocation</p>
                  {filledLines.length > 0 && (
                    <p className="font-mono text-[10px] leading-relaxed">
                      = {filledLines.map((l) => `${l.fund!.riskRating}×${l.allocation}%`).join(' + ')}
                      {' '}÷ {filledLines.reduce((s, l) => s + l.allocation, 0)}%
                      {' '}= <strong>{weightedScore.toFixed(2)}</strong>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Add funds and set allocations</p>
                <p className="text-xs mt-1">to calculate portfolio risk</p>
              </div>
            )}
          </div>

          {/* Copy-to-clipboard summary for adviser → client */}
          {filledLines.length > 0 && weightedScore !== null && !allocError && resultCategory && (
            <CopySummaryCard
              filledLines={filledLines}
              resultCategory={resultCategory}
              clientProfile={clientProfile}
              onClientProfileChange={setClientProfile}
              copied={copied}
              onCopy={() => {
                const fundLines = filledLines.map((l, i) =>
                  `${i + 1}.  🟦${l.fund!.name}, ${l.allocation}% ${l.fund!.riskCategory}🟦`
                ).join('\n');
                const profileLine = clientProfile
                  ? `\nYour risk profile is 🟦${clientProfile}🟦.`
                  : '';
                const text = `Funds available were shown and you have selected the following:\n${fundLines}\n\nThe overall risk classification of the funds selected by you is 🟦${resultCategory}🟦.${profileLine}`;
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            />
          )}

          {/* Risk Matrix collapsible */}
          <div className="rounded-lg border overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium bg-muted/50 hover:bg-muted/80 transition-colors"
              onClick={() => setShowMatrix((v) => !v)}
            >
              <span>SGA Fund Risk Matrix</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMatrix ? "rotate-180" : ""}`} />
            </button>
            {showMatrix && (
              <div className="p-3 overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr>
                      <th className="p-1 text-left" />
                      {MATRIX_COLS.map((c) => (
                        <th key={c} className="p-1 text-center font-medium text-muted-foreground">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX_ROWS.map((row) => (
                      <tr key={row.label}>
                        <td className="p-1 font-medium text-muted-foreground">{row.label}</td>
                        {row.ratings.map((r) => (
                          <td key={r} className="p-0.5">
                            <div className={`${MATRIX_BG[r]} rounded text-center py-1.5 font-bold text-white text-[11px]`}>
                              {r}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex gap-4 flex-wrap">
                    {(["Conservative","Moderate","Balanced","Growth","Aggressive"] as RiskCategory[]).map((c) => (
                      <span key={c} className={`px-1.5 py-0.5 rounded border font-medium ${RISK_CATEGORY_COLOR[c]}`}>{c}</span>
                    ))}
                  </div>
                  <p className="pt-1">1–3 Conservative · 4–5 Moderate · 6–8 Balanced · 9 Growth · 10–12 Aggressive</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FundBrowserModal
        open={showBrowser}
        onClose={() => setShowBrowser(false)}
        addedKeys={addedKeys}
        onAdd={handleBrowserAdd}
      />
    </div>
  );
}
