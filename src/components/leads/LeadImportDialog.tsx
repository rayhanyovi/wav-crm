import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Upload, AlertCircle, CheckCircle2, X, Layers, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import { useBulkCreateLeads, useLeads } from "@/hooks/useLeads";
import { isTelemarketer } from "@/lib/permissions";
import type { LeadStatus, LeadSource } from "@/data/types";

// ─── Column aliases ───────────────────────────────────────────────────────────
const COL_ALIASES: Record<string, string> = {
  // salutation
  salutation: "salutation", title: "salutation",
  // first_name
  "first name": "first_name", first_name: "first_name", firstname: "first_name", fname: "first_name",
  // last_name
  "last name": "last_name", last_name: "last_name", lastname: "last_name", lname: "last_name", surname: "last_name",
  // full name — handled specially
  name: "name", "full name": "name", fullname: "name",
  // phone
  phone: "phone", mobile: "phone", hp: "phone", handphone: "phone", tel: "phone",
  telephone: "phone", contact: "phone", "phone number": "phone", "mobile number": "phone",
  // email
  email: "email", "e-mail": "email", emailaddress: "email",
  // status
  status: "status", "lead status": "status",
  // source
  source: "source", "lead source": "source",
  // demographics
  age: "age", gender: "gender", sex: "gender",
  "residential status": "residential_status", residential_status: "residential_status",
  residential: "residential_status",
  "income range": "income_range", income_range: "income_range", income: "income_range",
  zipcode: "zipcode", "zip code": "zipcode", postal: "zipcode", postcode: "zipcode",
  // site → stored in notes
  site: "site", campaign: "site", "campaign name": "site",
  // notes
  notes: "notes", note: "notes", remarks: "notes", remark: "notes", comments: "notes",
};

// ─── Value normalisers ─────────────────────────────────────────────────────────
const VALID_STATUSES = new Set<LeadStatus>(["NA", "APPOINTMENT", "NOT_INTERESTED", "AVOID", "KIV", "OTHERS"]);
const STATUS_MAP: Record<string, LeadStatus> = {
  new: "NA", contacted: "NA", dormant: "NA", na: "NA",
  qualified: "APPOINTMENT", appointment: "APPOINTMENT",
  converted: "OTHERS", others: "OTHERS",
  lost: "NOT_INTERESTED", "not interested": "NOT_INTERESTED", not_interested: "NOT_INTERESTED",
  avoid: "AVOID", abandoned: "AVOID", abandon: "AVOID",
  kiv: "KIV", "keep in view": "KIV",
};

const VALID_SOURCES = new Set<LeadSource>([
  "AP_MARKETING", "LP_MARKETING", "OWN_SOURCE", "OTHERS",
]);
const SOURCE_MAP: Record<string, LeadSource> = {
  "ap marketing": "AP_MARKETING", ap_marketing: "AP_MARKETING", ap: "AP_MARKETING",
  "lp marketing": "LP_MARKETING", lp_marketing: "LP_MARKETING", lp: "LP_MARKETING",
  "own source": "OWN_SOURCE", own_source: "OWN_SOURCE", own: "OWN_SOURCE",
  referral: "OWN_SOURCE", manual: "OWN_SOURCE",
  "cold call": "OWN_SOURCE", cold_call: "OWN_SOURCE",
  other: "OTHERS", others: "OTHERS",
};

function normaliseStatus(raw: string): LeadStatus {
  const key = raw.trim().toLowerCase();
  if (VALID_STATUSES.has(raw.trim().toUpperCase() as LeadStatus))
    return raw.trim().toUpperCase() as LeadStatus;
  return STATUS_MAP[key] ?? "NA";
}

function normaliseSource(raw: string): LeadSource {
  const key = raw.trim().toLowerCase();
  if (VALID_SOURCES.has(raw.trim().toUpperCase() as LeadSource))
    return raw.trim().toUpperCase() as LeadSource;
  return SOURCE_MAP[key] ?? "OTHERS";
}

// ─── CSV/TSV parser ────────────────────────────────────────────────────────────
function parseRows(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const firstLine = lines[0];
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delim = tabs >= commas ? "\t" : ",";

  return lines.map((line) => {
    if (delim === ",") {
      const result: string[] = [];
      let field = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === "," && !inQuote) { result.push(field.trim()); field = ""; continue; }
        field += ch;
      }
      result.push(field.trim());
      return result;
    }
    return line.split("\t").map((f) => f.trim());
  });
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
function sheetToRows(ws: XLSX.WorkSheet): string[][] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  return rows
    .filter((r) => (r as unknown[]).some((c) => c !== ""))
    .map((r) =>
      (r as unknown[]).map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (typeof cell === "number") return String(cell);
        if (cell instanceof Date) return cell.toISOString().split("T")[0];
        return String(cell).trim();
      }),
    );
}

function parseXlsx(buffer: ArrayBuffer, sheetIndex = 0): { rows: string[][]; sheetNames: string[] } {
  const wb = XLSX.read(buffer, { type: "array", cellText: false, cellDates: true });
  const sheetNames = wb.SheetNames;
  const ws = wb.Sheets[sheetNames[Math.min(sheetIndex, sheetNames.length - 1)]];
  return { rows: sheetToRows(ws), sheetNames };
}

// Normalise phone: Excel stores numbers in scientific notation (8.4E+07 → "84000000")
function normalisePhone(raw: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  // Parse scientific notation or plain number
  const num = Number(trimmed);
  if (!isNaN(num) && num > 0) {
    // Convert to integer string, strip any decimal
    return String(Math.round(num));
  }
  // Already a string phone — strip non-digit chars except leading +
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  return cleaned || undefined;
}

// Digits-only key for duplicate matching (ignores +, spaces, dashes). Returns
// null for missing / too-short values so those rows are never flagged as dupes.
function phoneKey(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

interface ParsedRow {
  salutation?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  status: LeadStatus;
  source: LeadSource;
  age?: number;
  gender?: string;
  residential_status?: string;
  income_range?: string;
  zipcode?: string;
  notes?: string;
  _raw: Record<string, string>;
  _valid: boolean;
  _error?: string;
}

function buildRows(rows: string[][]): ParsedRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const mapped = headers.map((h) => COL_ALIASES[h] ?? h);

  return rows.slice(1).map((cols) => {
    const raw: Record<string, string> = {};
    mapped.forEach((key, i) => { raw[key] = cols[i] ?? ""; });

    // Resolve first/last name
    let firstName = (raw.first_name || "").trim();
    let lastName = (raw.last_name || "").trim();
    if (!firstName && raw.name) {
      const parts = raw.name.trim().split(/\s+/);
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    }

    // Merge site into notes
    const sitePart = raw.site ? `[${raw.site.trim()}]` : "";
    const notesBase = raw.notes ? raw.notes.trim() : "";
    const mergedNotes = [sitePart, notesBase].filter(Boolean).join(" ") || undefined;

    const valid = !!(firstName);
    return {
      salutation: raw.salutation ? raw.salutation.trim() : undefined,
      first_name: firstName,
      last_name: lastName || "-",
      phone: normalisePhone(raw.phone || ""),
      email: raw.email || undefined,
      status: normaliseStatus(raw.status || ""),
      source: normaliseSource(raw.source || ""),
      age: raw.age ? parseInt(raw.age) || undefined : undefined,
      gender: raw.gender || undefined,
      residential_status: raw.residential_status || undefined,
      income_range: raw.income_range || undefined,
      zipcode: raw.zipcode || undefined,
      notes: mergedNotes,
      _raw: raw,
      _valid: valid,
      _error: valid ? undefined : "Missing first name",
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
}

const ALL_SOURCES: LeadSource[] = [
  "AP_MARKETING", "LP_MARKETING", "OWN_SOURCE", "OTHERS",
];

const SOURCE_LABELS: Record<LeadSource, string> = {
  AP_MARKETING: "AP Marketing",
  LP_MARKETING: "LP Marketing",
  OWN_SOURCE: "Own Source",
  OTHERS: "Others",
};

export function LeadImportDialog({ open, onClose }: Props) {
  const { currentUser } = useAuthStore();
  const bulkCreateMutation = useBulkCreateLeads();
  // Existing leads (shared react-query cache) — used to detect phone duplicates.
  const { data: existingLeads = [] } = useLeads({ includeAbandoned: true });
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [done, setDone] = useState<{ ok: number; skipped: number; duplicates: number; failed: number } | null>(null);
  const [defaultSource, setDefaultSource] = useState<LeadSource>("AP_MARKETING");
  const [fileName, setFileName] = useState<string | null>(null);
  // Multi-sheet support
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null);

  // ── Duplicate detection (by phone) ──────────────────────────────────────────
  const existingPhones = useMemo(() => {
    const s = new Set<string>();
    for (const l of existingLeads) {
      const k = phoneKey(l.phone);
      if (k) s.add(k);
    }
    return s;
  }, [existingLeads]);

  // Per-row duplicate reason, index-aligned with `parsed`.
  // "existing" = phone already in the system; "file" = repeated earlier in this file.
  const dupFlags = useMemo<(null | "existing" | "file")[]>(() => {
    const seen = new Set<string>();
    return parsed.map((r) => {
      const k = phoneKey(r.phone);
      if (!k) return null;
      let reason: "existing" | "file" | null = null;
      if (existingPhones.has(k)) reason = "existing";
      else if (seen.has(k)) reason = "file";
      seen.add(k);
      return reason;
    });
  }, [parsed, existingPhones]);

  const duplicateCount = dupFlags.filter(Boolean).length;

  const applyDefaultSource = (rows: ParsedRow[]): ParsedRow[] =>
    rows.map((r) =>
      r._raw.source ? r : { ...r, source: defaultSource },
    );

  const handleParse = (raw: string) => {
    setText(raw);
    const rows = parseRows(raw);
    setParsed(applyDefaultSource(buildRows(rows)));
    setDone(null);
  };

  const loadSheet = (buffer: ArrayBuffer, sheetIdx: number, source: LeadSource) => {
    const { rows, sheetNames: names } = parseXlsx(buffer, sheetIdx);
    setSheetNames(names);
    setParsed(applyDefaultSource(buildRows(rows)).map((r) =>
      r._raw.source ? r : { ...r, source }
    ));
    setText("");
    setDone(null);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        setXlsxBuffer(buffer);
        setSelectedSheet(0);
        loadSheet(buffer, 0, defaultSource);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setSheetNames([]);
      setXlsxBuffer(null);
      const reader = new FileReader();
      reader.onload = (e) => handleParse(e.target?.result as string ?? "");
      reader.readAsText(file);
    }
  };

  const handleSheetChange = (idx: number) => {
    if (!xlsxBuffer) return;
    setSelectedSheet(idx);
    loadSheet(xlsxBuffer, idx, defaultSource);
  };

  const handleImport = () => {
    if (!currentUser) return;
    setImporting(true);
    const isTm = isTelemarketer(currentUser);
    // Import valid rows, skipping phone duplicates unless the user opted to keep them.
    const rows = parsed.filter((r, i) => r._valid && (!skipDuplicates || !dupFlags[i]));
    const skipped = parsed.filter((r) => !r._valid).length;
    const duplicates = skipDuplicates ? parsed.filter((r, i) => r._valid && dupFlags[i]).length : 0;

    const payloads = rows.map((row) => ({
      salutation: row.salutation,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      email: row.email,
      status: row.status,
      source: row.source,
      age: row.age,
      gender: row.gender,
      residential_status: row.residential_status,
      income_range: row.income_range,
      zipcode: row.zipcode,
      notes: row.notes,
      telemarketer_owner_id: isTm ? currentUser.id : undefined,
      assigned_to_id: isTm ? undefined : currentUser.id,
      created_by: currentUser.id,
      updated_at: new Date().toISOString(),
    }));

    bulkCreateMutation.mutate(payloads, {
      onSuccess: (result) => {
        setImporting(false);
        setDone({
          ok: result.created.length,
          skipped,
          duplicates,
          failed: result.failed.length,
        });
      },
      onError: (err) => {
        setImporting(false);
        toast.error(
          `Import failed: ${err instanceof Error ? err.message : "unknown error"}. Please try again.`,
        );
      },
    });
  };

  const handleClose = () => {
    setText("");
    setParsed([]);
    setDone(null);
    setFileName(null);
    setSheetNames([]);
    setSelectedSheet(0);
    setXlsxBuffer(null);
    setSkipDuplicates(true);
    onClose();
  };

  const validRows = parsed.filter((r) => r._valid);
  const invalidRows = parsed.filter((r) => !r._valid);
  // What will actually be created: valid rows, minus duplicates when skipping is on.
  const importRows = parsed.filter((r, i) => r._valid && (!skipDuplicates || !dupFlags[i]));
  const previewRows = parsed.slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV / Google Sheets</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!done ? (
            <>
              {/* Instructions */}
              <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How to import</p>
                <p>1. Upload an <code>.xlsx</code> / <code>.xls</code> / <code>.csv</code> file, or paste copied spreadsheet data below.</p>
                <p>2. Recognised columns: <code>salutation</code>, <code>first name</code>, <code>last name</code>, <code>phone</code>, <code>age</code>, <code>gender</code>, <code>residential status</code>, <code>postcode</code>, <code>income</code>, <code>site</code>, <code>email</code>, <code>source</code>, <code>status</code>, <code>notes</code></p>
                <p>3. If the sheet has no <code>source</code> column, all leads will use the default source selected below.</p>
              </div>

              {/* Default source selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground shrink-0">Default source</span>
                <Select
                  value={defaultSource}
                  onValueChange={(v) => {
                    setDefaultSource(v as LeadSource);
                    setParsed((prev) =>
                      prev.map((r) => (r._raw.source ? r : { ...r, source: v as LeadSource })),
                    );
                  }}
                >
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_SOURCES.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">(used when sheet has no Source column)</span>
              </div>

              {/* File upload */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                {fileName
                  ? <p className="text-sm font-medium">{fileName}</p>
                  : <p className="text-sm text-muted-foreground">Drop a .xlsx / .xls / .csv file here or click to browse</p>
                }
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {/* Sheet selector — shown when Excel has multiple sheets */}
              {sheetNames.length > 1 && (
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground shrink-0">Sheet:</span>
                  <div className="flex flex-wrap gap-1">
                    {sheetNames.map((name, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSheetChange(idx)}
                        className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                          selectedSheet === idx
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>or paste data directly</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Paste area */}
              <Textarea
                placeholder={"First Name\tLast Name\tPhone\tEmail\tStatus\tSource\nAli\tBin Ahmad\t+65 9xxx xxxx\t\tNA\tCOLD_CALL"}
                value={text}
                onChange={(e) => handleParse(e.target.value)}
                rows={5}
                className="font-mono text-xs resize-none"
              />

              {/* Parse feedback */}
              {parsed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {importRows.length} will import
                    </span>
                    {duplicateCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setSkipDuplicates((s) => !s)}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                          skipDuplicates
                            ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                            : "text-muted-foreground line-through hover:bg-muted"
                        }`}
                        title={skipDuplicates ? "Click to import duplicates anyway" : "Click to skip duplicates"}
                      >
                        <Copy className="h-4 w-4" />
                        {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}{skipDuplicates ? " skipped" : " kept"}
                      </button>
                    )}
                    {invalidRows.length > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {invalidRows.length} skipped (missing name)
                      </span>
                    )}
                  </div>

                  {/* Preview table */}
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Age</TableHead>
                          <TableHead className="text-xs">Residential</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs w-6"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, i) => (
                          <TableRow
                            key={i}
                            className={!row._valid || (skipDuplicates && dupFlags[i]) ? "opacity-50" : ""}
                          >
                            <TableCell className="text-xs">
                              {[row.salutation, row.first_name, row.last_name].filter(Boolean).join(" ")}
                              {!row._valid && (
                                <span className="ml-1 text-destructive text-[10px]">({row._error})</span>
                              )}
                              {row._valid && dupFlags[i] && (
                                <span className="ml-1 text-amber-600 dark:text-amber-400 text-[10px]">
                                  (duplicate{dupFlags[i] === "file" ? " in file" : ""})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{row.phone ?? "—"}</TableCell>
                            <TableCell className="text-xs">{row.age ?? "—"}</TableCell>
                            <TableCell className="text-xs">{row.residential_status ?? "—"}</TableCell>
                            <TableCell className="text-xs">{row.source.replace("_", " ")}</TableCell>
                            <TableCell>
                              {row._valid
                                ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                                : <X className="h-3 w-3 text-destructive" />
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsed.length > 6 && (
                      <p className="text-xs text-center text-muted-foreground py-1.5 border-t">
                        … and {parsed.length - 6} more rows
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              {done.failed > 0 ? (
                <AlertCircle className="h-12 w-12 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              )}
              <h3 className="text-lg font-semibold">{done.ok} of {done.ok + done.failed} leads imported</h3>
              {done.duplicates > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {done.duplicates} duplicate{done.duplicates === 1 ? "" : "s"} skipped (phone already exists)
                </p>
              )}
              {done.skipped > 0 && (
                <p className="text-sm text-muted-foreground">{done.skipped} rows skipped (missing name)</p>
              )}
              {done.failed > 0 && (
                <p className="text-sm text-destructive max-w-sm">
                  {done.failed} lead{done.failed === 1 ? "" : "s"} couldn't be saved. Re-upload the same
                  file to retry them — leads already imported will be skipped as duplicates.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {done.ok > 0
                  ? "Imported leads are now visible in your Leads list."
                  : "No leads were added."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          {!done ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                disabled={importRows.length === 0 || importing}
                onClick={handleImport}
              >
                {importing ? "Importing…" : `Import ${importRows.length} Leads`}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
