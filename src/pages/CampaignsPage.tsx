import { useState } from "react";
import { Plus, Megaphone, Package, Boxes, BarChart3, Trash2 } from "lucide-react";
import { useCrmStore } from "@/store/useCrmStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CampaignStatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import { canManage } from "@/lib/permissions";
import { getCampaignDealConversions } from "@/lib/selectors";
import { useNavigate, useSearchParams } from "react-router-dom";
import { campaignIncludesProduct, getCampaignOfferingLabel } from "@/lib/campaignOfferings";
import { useLayoutStore } from "@/store/useLayoutStore";
import type { CampaignOfferItem, CampaignType, CampaignStatus } from "@/data/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CampaignOfferDraft = CampaignOfferItem & { rowId: string };

const emptyOfferRow = (): CampaignOfferDraft => ({
  rowId: crypto.randomUUID(),
  kind: "PRODUCT",
  id: "",
});

function getCampaignTypeFromOffers(items: CampaignOfferItem[]): CampaignType {
  const kinds = new Set(items.map((item) => item.kind));
  if (kinds.size > 1) return "MIXED";
  return kinds.has("BUNDLE") ? "BUNDLE" : "PRODUCT";
}

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export function CampaignsPage() {
  const { products, bundles, campaigns, activities, deals, createProduct, updateProduct, createBundle, updateBundle, createCampaign } = useCrmStore();
  const { currentUser } = useAuthStore();
  const { layoutMode } = useLayoutStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = ["campaigns", "products", "bundles", "performance"].includes(tabParam || "") ? tabParam! : "campaigns";

  // Product dialog
  const [productOpen, setProductOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ name: "", ticker: "", description: "", category: "", risk_score: 5, is_active: true });

  // Bundle dialog
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleForm, setBundleForm] = useState({ name: "", description: "", product_ids: [] as string[], risk_score: 5, is_active: true });

  // Campaign dialog
  const [campOpen, setCampOpen] = useState(false);
  const [campForm, setCampForm] = useState({
    name: "",
    description: "",
    offer_items: [emptyOfferRow()],
    status: "ACTIVE" as CampaignStatus,
    start_date: "",
    end_date: "",
    target_count: "",
    script: "",
  });

  const resetCampaignForm = () => {
    setCampForm({
      name: "",
      description: "",
      offer_items: [emptyOfferRow()],
      status: "ACTIVE",
      start_date: "",
      end_date: "",
      target_count: "",
      script: "",
    });
  };

  const handleCreateProduct = () => {
    if (!prodForm.name || !currentUser) return;
    createProduct({ ...prodForm, is_active: true }, currentUser.id);
    setProductOpen(false);
    setProdForm({ name: "", ticker: "", description: "", category: "", risk_score: 5, is_active: true });
  };

  const handleCreateBundle = () => {
    if (!bundleForm.name || !currentUser) return;
    createBundle({ ...bundleForm, is_active: true }, currentUser.id);
    setBundleOpen(false);
    setBundleForm({ name: "", description: "", product_ids: [], risk_score: 5, is_active: true });
  };

  const handleCreateCampaign = () => {
    if (!campForm.name || !currentUser) return;
    const validOfferItems = campForm.offer_items
      .filter((item) => item.id)
      .map(({ kind, id }) => ({ kind, id }));
    const firstProduct = validOfferItems.find((item) => item.kind === "PRODUCT");
    const firstBundle = validOfferItems.find((item) => item.kind === "BUNDLE");
    const campaignType = getCampaignTypeFromOffers(validOfferItems);

    createCampaign({
      ...campForm,
      type: campaignType,
      offer_items: validOfferItems,
      target_count: campForm.target_count ? parseInt(campForm.target_count) : undefined,
      product_id: firstProduct?.id,
      bundle_id: firstBundle?.id,
      created_by: currentUser.id,
    }, currentUser.id);
    setCampOpen(false);
    resetCampaignForm();
  };

  // Performance data
  const campPerf = campaigns.map((camp) => {
    const campActs = activities.filter((a) => a.campaign_id === camp.id && a.type === "CALL" && !a.deleted_at);
    const calls = campActs.length;
    const pickups = campActs.filter((a) => a.result !== "NO_ANSWER").length;
    const conversions = getCampaignDealConversions(activities, deals, new Set([camp.id])).length;
    return { ...camp, calls, pickups, conversions, rate: calls ? Math.round((conversions / calls) * 100) : 0 };
  });

  // Product performance
  const productPerf = products.map((p) => {
    const productCamps = campaigns.filter((c) => campaignIncludesProduct(c, p.id, []));
    const bundleCamps = bundles.filter((b) => b.product_ids.includes(p.id));
    const soloActs = activities.filter((a) => a.campaign_id && productCamps.find((c) => c.id === a.campaign_id) && a.type === "CALL" && !a.deleted_at).length;
    const bundleActsByBundle = bundleCamps.map((b) => {
      const bCamps = campaigns.filter((c) => {
        const offerItems = c.offer_items?.filter((item) => item.id) ?? [];
        return offerItems.length > 0
          ? offerItems.some((item) => item.kind === "BUNDLE" && item.id === b.id)
          : c.bundle_id === b.id;
      });
      const count = activities.filter((a) => a.campaign_id && bCamps.find((c) => c.id === a.campaign_id) && a.type === "CALL" && !a.deleted_at).length;
      return { bundleName: b.name, count };
    });
    return { ...p, soloActs, bundleActs: bundleActsByBundle };
  });

  const canEdit = canManage(currentUser);
  const hasCampaignOffer = campForm.offer_items.some((item) => item.id);
  const totalCalls = campPerf.reduce((sum, campaign) => sum + campaign.calls, 0);
  const totalPickups = campPerf.reduce((sum, campaign) => sum + campaign.pickups, 0);
  const totalConversions = campPerf.reduce((sum, campaign) => sum + campaign.conversions, 0);
  const averageConversionRate = totalCalls ? Math.round((totalConversions / totalCalls) * 100) : 0;
  const campaignChartData = campPerf.map((campaign) => ({
    name: campaign.name,
    calls: campaign.calls,
    pickups: campaign.pickups,
    conversions: campaign.conversions,
    rate: campaign.rate,
  }));
  const productChartData = productPerf
    .map((product) => {
      const bundleTotal = product.bundleActs.reduce((sum, bundle) => sum + bundle.count, 0);
      return {
        name: product.name,
        solo: product.soloActs,
        bundle: bundleTotal,
        total: product.soloActs + bundleTotal,
      };
    })
    .filter((product) => product.total > 0);
  const outcomeChartData = [
    { name: "Pickups", value: totalPickups },
    { name: "No Answer", value: Math.max(totalCalls - totalPickups, 0) },
  ].filter((item) => item.value > 0);
  const activeCreateButton = (() => {
    if (!canEdit) return null;
    if (activeTab === "campaigns") {
      return <Button onClick={() => setCampOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" />New Campaign</Button>;
    }
    if (activeTab === "products") {
      return <Button onClick={() => setProductOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" />New Product</Button>;
    }
    if (activeTab === "bundles") {
      return <Button onClick={() => setBundleOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" />New Bundle</Button>;
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Campaigns</h1>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", value);
          return next;
        })}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {layoutMode === "sidebar" ? (
            <TabsList>
              <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" />Campaigns</TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />Products</TabsTrigger>
              <TabsTrigger value="bundles" className="gap-1.5"><Boxes className="h-3.5 w-3.5" />Bundles</TabsTrigger>
              <TabsTrigger value="performance" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Performance</TabsTrigger>
            </TabsList>
          ) : (
            <div />
          )}
          {activeCreateButton}
        </div>

        {/* Campaigns */}
        <TabsContent value="campaigns" className="space-y-3">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Offering</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const offering = getCampaignOfferingLabel(c, products, bundles);
                  const calls = activities.filter((a) => a.campaign_id === c.id && a.type === "CALL" && !a.deleted_at).length;
                  const pct = c.target_count ? Math.min(100, Math.round((calls / c.target_count) * 100)) : 0;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs">{offering || "N/A"}</TableCell>
                      <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(c.start_date)} - {formatDate(c.end_date)}</TableCell>
                      <TableCell className="text-xs">{c.target_count ?? "N/A"}</TableCell>
                      <TableCell className="w-24">
                        {c.target_count ? <div className="flex items-center gap-1"><Progress value={pct} className="h-1.5 w-16" /><span className="text-xs">{calls}/{c.target_count}</span></div> : <span className="text-xs text-muted-foreground">{calls} calls</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="space-y-3">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Avg. Return</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-muted-foreground">{p.ticker || "N/A"}</TableCell>
                    <TableCell className="text-xs">{p.category || "N/A"}</TableCell>
                    <TableCell className="text-xs">
                      {p.risk_score != null ? (
                        <span className={`font-semibold ${p.risk_score <= 3 ? "text-green-600" : p.risk_score <= 6 ? "text-yellow-600" : "text-red-600"}`}>
                          {p.risk_score}/10
                        </span>
                      ) : "N/A"}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-green-600">
                      {p.annual_return != null ? `+${p.annual_return}%` : "N/A"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.market_cap || "N/A"}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {canEdit ? (
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(v) => currentUser && updateProduct(p.id, { is_active: v }, currentUser.id)}
                        />
                      ) : (
                        <Badge variant={p.is_active ? "secondary" : "outline"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Bundles */}
        <TabsContent value="bundles" className="space-y-3">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bundles/${b.id}`)}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {b.product_ids.map((pid) => {
                          const prod = products.find((p) => p.id === pid);
                          const alloc = b.allocations?.[pid];
                          return prod ? (
                            <Badge key={pid} variant="secondary" className="text-xs font-mono">
                              {prod.ticker}{alloc != null ? ` ${alloc}%` : ""}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.risk_score != null ? (
                        <span className={`font-semibold ${b.risk_score <= 3 ? "text-green-600" : b.risk_score <= 6 ? "text-yellow-600" : "text-red-600"}`}>
                          {b.risk_score}/10
                        </span>
                      ) : "N/A"}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {canEdit ? (
                        <Switch
                          checked={b.is_active}
                          onCheckedChange={(v) => currentUser && updateBundle(b.id, { is_active: v }, currentUser.id)}
                        />
                      ) : (
                        <Badge variant={b.is_active ? "secondary" : "outline"}>{b.is_active ? "Active" : "Inactive"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{b.description || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Calls", value: totalCalls },
              { label: "Pickups", value: totalPickups },
              { label: "Conversions", value: totalConversions },
              { label: "Avg. Conv. Rate", value: `${averageConversionRate}%` },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="mt-0.5 text-2xl font-bold">{metric.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Campaign Funnel</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="calls" name="Calls" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pickups" name="Pickups" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="conversions" name="Conversions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Call Outcomes</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {outcomeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={outcomeChartData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={92}
                        label={({ name, percent }) =>
                          `${name} ${percent != null ? Math.round(percent * 100) : 0}%`
                        }
                      >
                        {outcomeChartData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No call data yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversion Rate by Campaign</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignChartData} layout="vertical" margin={{ top: 8, right: 24, left: 28, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={92} />
                    <Tooltip formatter={(value) => [`${value}%`, "Conversion Rate"]} />
                    <Bar dataKey="rate" name="Conv. Rate" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Product Offer Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {productChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="solo" name="Solo Product" stackId="offers" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bundle" name="Bundle" stackId="offers" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No product offer data yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product dialog */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Ticker</Label><Input value={prodForm.ticker} onChange={(e) => setProdForm({ ...prodForm, ticker: e.target.value })} /></div>
              <div className="space-y-1"><Label>Category</Label><Input value={prodForm.category} onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProduct} disabled={!prodForm.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bundle dialog */}
      <Dialog open={bundleOpen} onOpenChange={setBundleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Bundle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={bundleForm.name} onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} rows={2} /></div>
            <div className="space-y-1">
              <Label>Products</Label>
              <div className="space-y-1">
                {products.filter((p) => p.is_active).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bundleForm.product_ids.includes(p.id)}
                      onChange={(e) => {
                        setBundleForm({
                          ...bundleForm,
                          product_ids: e.target.checked
                            ? [...bundleForm.product_ids, p.id]
                            : bundleForm.product_ids.filter((id) => id !== p.id),
                        });
                      }}
                      className="rounded"
                    />
                    {p.name} <span className="text-muted-foreground text-xs">({p.ticker})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBundleOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBundle} disabled={!bundleForm.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign dialog */}
      <Dialog open={campOpen} onOpenChange={setCampOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="space-y-1"><Label>Name *</Label><Input value={campForm.name} onChange={(e) => setCampForm({ ...campForm, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={campForm.description} onChange={(e) => setCampForm({ ...campForm, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Target Call Count</Label><Input type="number" value={campForm.target_count} onChange={(e) => setCampForm({ ...campForm, target_count: e.target.value })} /></div>
                <div className="space-y-1"><Label>Status</Label><Select value={campForm.status} onValueChange={(v) => setCampForm({ ...campForm, status: v as CampaignStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="PAUSED">Paused</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={campForm.start_date} onChange={(e) => setCampForm({ ...campForm, start_date: e.target.value })} /></div>
                <div className="space-y-1"><Label>End Date</Label><Input type="date" value={campForm.end_date} onChange={(e) => setCampForm({ ...campForm, end_date: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Offerings *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCampForm({ ...campForm, offer_items: [...campForm.offer_items, emptyOfferRow()] })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Kind</TableHead>
                        <TableHead>Offering</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campForm.offer_items.map((offerItem, index) => {
                        const options = offerItem.kind === "PRODUCT"
                          ? products.filter((p) => p.is_active)
                          : bundles.filter((b) => b.is_active);

                        return (
                          <TableRow key={offerItem.rowId}>
                            <TableCell>
                              <Select
                                value={offerItem.kind}
                                onValueChange={(v) => {
                                  const nextItems = [...campForm.offer_items];
                                  nextItems[index] = { ...offerItem, kind: v as CampaignOfferItem["kind"], id: "" };
                                  setCampForm({ ...campForm, offer_items: nextItems });
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PRODUCT">Product</SelectItem>
                                  <SelectItem value="BUNDLE">Bundle</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={offerItem.id}
                                onValueChange={(v) => {
                                  const nextItems = [...campForm.offer_items];
                                  nextItems[index] = { ...offerItem, id: v };
                                  setCampForm({ ...campForm, offer_items: nextItems });
                                }}
                              >
                                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                <SelectContent>
                                  {options.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={campForm.offer_items.length === 1}
                                onClick={() => setCampForm({ ...campForm, offer_items: campForm.offer_items.filter((item) => item.rowId !== offerItem.rowId) })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            <div className="space-y-1 flex flex-col">
              <Label>Call Script</Label>
              <Textarea
                value={campForm.script}
                onChange={(e) => setCampForm({ ...campForm, script: e.target.value })}
                className="min-h-[420px] flex-1"
                placeholder="Script displayed to the telemarketer during calls..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCampaign} disabled={!campForm.name || !hasCampaignOffer}>Create Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
