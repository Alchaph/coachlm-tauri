import { useState, useMemo } from "react";
import { Plus, Zap, Search, Info, X } from "lucide-react";
import { toast } from "sonner";
import { type Shoe, BUILT_IN_SHOES } from "../data/shoes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const PRESET_DISTANCES: { label: string; km: number }[] = [
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
  { label: "Half Marathon", km: 21.0975 },
  { label: "Marathon", km: 42.195 },
  { label: "Ultra (50K)", km: 50 },
];

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "--:--";
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${String(hours)}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function estimateBenefit(hasCarbonPlate: boolean, stackHeight: number): number {
  if (hasCarbonPlate && stackHeight >= 35) return 3.5;
  if (hasCarbonPlate && stackHeight < 35) return 2.5;
  if (!hasCarbonPlate && stackHeight >= 35) return 1.2;
  return 0.8;
}

interface ShoeResult {
  shoe: Shoe;
  timeSaved: number;
  projectedTime: number;
}

interface CompareState {
  shoeAId: string | null;
  shoeBId: string | null;
}

function TierBadge({ tier }: { tier: "supershoe" | "racer" | "trainer" }) {
  if (tier === "supershoe") {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/20">
        Supershoe
      </Badge>
    );
  }
  if (tier === "racer") {
    return (
      <Badge className="bg-warning/10 text-warning border-warning/20">
        Racer
      </Badge>
    );
  }
  return <Badge variant="secondary">Trainer</Badge>;
}

export default function ShoeCalculator() {
  const [selectedDistanceKm, setSelectedDistanceKm] = useState<number | null>(null);
  const [customDistanceStr, setCustomDistanceStr] = useState("");
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");
  const [shoes, setShoes] = useState<Shoe[]>(BUILT_IN_SHOES);
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customCarbon, setCustomCarbon] = useState(false);
  const [customStack, setCustomStack] = useState("");
  const [customBenefit, setCustomBenefit] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compare, setCompare] = useState<CompareState>({ shoeAId: null, shoeBId: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedTier, setSelectedTier] = useState<"all" | "supershoe" | "racer" | "trainer">("all");
  const [formErrors, setFormErrors] = useState<{ name?: string; stack?: string }>({});

  const distanceKm: number | null = (() => {
    if (selectedDistanceKm !== null) return selectedDistanceKm;
    const parsed = parseFloat(customDistanceStr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return null;
  })();

  const paceTotalSeconds: number | null = (() => {
    const mins = parseInt(paceMinutes, 10);
    const secs = parseInt(paceSeconds, 10);
    if (isNaN(mins) || isNaN(secs)) return null;
    if (mins < 0 || secs < 0 || secs >= 60) return null;
    const total = mins * 60 + secs;
    if (total <= 0) return null;
    return total;
  })();

  const originalTimeSeconds: number | null = (() => {
    if (distanceKm === null || paceTotalSeconds === null) return null;
    return distanceKm * paceTotalSeconds;
  })();

  const allBrands = useMemo(() => {
    const brands = new Set<string>();
    shoes.forEach((s) => { brands.add(s.brand); });
    return Array.from(brands).sort();
  }, [shoes]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  const hasActiveFilters = searchQuery.trim() !== "" || selectedBrands.size > 0 || selectedTier !== "all";

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedBrands(new Set());
    setSelectedTier("all");
  };

  const filteredShoes = useMemo(() => {
    return shoes.filter((shoe) => {
      if (searchQuery.trim() !== "" && !shoe.name.toLowerCase().includes(searchQuery.toLowerCase()) && !shoe.brand.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedBrands.size > 0 && !selectedBrands.has(shoe.brand)) {
        return false;
      }
      if (selectedTier !== "all" && shoe.tier !== selectedTier) {
        return false;
      }
      return true;
    });
  }, [shoes, searchQuery, selectedBrands, selectedTier]);

  const results: ShoeResult[] = (() => {
    if (originalTimeSeconds === null) return [];
    return filteredShoes
      .map((shoe) => {
        const benefit = shoe.speedBenefitPercent;
        const timeSaved = originalTimeSeconds * (benefit / (100 + benefit));
        const projectedTime = originalTimeSeconds - timeSaved;
        return { shoe, timeSaved, projectedTime };
      })
      .sort((a, b) => b.timeSaved - a.timeSaved);
  })();

  const handleAddCustomShoe = () => {
    const errors: { name?: string; stack?: string } = {};

    if (customName.trim() === "") {
      errors.name = "Shoe name is required";
    }
    const stackVal = parseInt(customStack, 10);
    if (isNaN(stackVal) || stackVal <= 0) {
      errors.stack = "Enter a valid stack height (mm)";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    let benefit: number;
    const parsedBenefit = parseFloat(customBenefit);
    if (!isNaN(parsedBenefit) && parsedBenefit > 0) {
      benefit = parsedBenefit;
    } else {
      benefit = estimateBenefit(customCarbon, stackVal);
    }

    const tier: "supershoe" | "racer" | "trainer" =
      benefit >= 3.5 ? "supershoe" : benefit >= 2.0 ? "racer" : "trainer";

    const newShoe: Shoe = {
      id: `custom-${String(Date.now())}`,
      name: customName.trim(),
      brand: customBrand.trim() || "Custom",
      hasCarbonPlate: customCarbon,
      stackHeight: stackVal,
      speedBenefitPercent: benefit,
      tier,
      isCustom: true,
    };

    setShoes((prev) => [...prev, newShoe]);
    setCustomName("");
    setCustomBrand("");
    setCustomCarbon(false);
    setCustomStack("");
    setCustomBenefit("");
    toast.success(`${newShoe.name} added`);
  };

  const compareResultA = compare.shoeAId !== null ? results.find((r) => r.shoe.id === compare.shoeAId) : null;
  const compareResultB = compare.shoeBId !== null ? results.find((r) => r.shoe.id === compare.shoeBId) : null;

  const tierFilterOptions: { label: string; value: "all" | "supershoe" | "racer" | "trainer" }[] = [
    { label: "All Tiers", value: "all" },
    { label: "Supershoe", value: "supershoe" },
    { label: "Racer", value: "racer" },
    { label: "Trainer", value: "trainer" },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 bg-background">
      <div className="max-w-[960px]">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-foreground m-0">Shoe Speed Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How much faster will you finish with each shoe?
          </p>
        </div>

        <Card className="mb-5">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-[15px] font-semibold text-foreground">Race Setup</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-4">
              <div className="text-[13px] text-muted-foreground mb-2 font-medium">Distance</div>
              <div className="flex gap-2 flex-wrap">
                {PRESET_DISTANCES.map((d) => (
                  <Button
                    key={d.km}
                    type="button"
                    variant={selectedDistanceKm === d.km ? "default" : "secondary"}
                    size="sm"
                    onClick={() => {
                      setSelectedDistanceKm(d.km);
                      setCustomDistanceStr("");
                    }}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="Custom km"
                  value={customDistanceStr}
                  onChange={(e) => {
                    setCustomDistanceStr(e.target.value);
                    setSelectedDistanceKm(null);
                  }}
                  className="w-[120px]"
                />
                <span className="text-[13px] text-muted-foreground">km</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[13px] text-muted-foreground mb-2 font-medium">Pace (min:sec per km)</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="min"
                  value={paceMinutes}
                  onChange={(e) => { setPaceMinutes(e.target.value); }}
                  className="w-[72px] text-center"
                />
                <span className="text-base text-muted-foreground font-bold">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="sec"
                  value={paceSeconds}
                  onChange={(e) => { setPaceSeconds(e.target.value); }}
                  className="w-[72px] text-center"
                />
                <span className="text-[13px] text-muted-foreground">/km</span>
              </div>
            </div>

            {originalTimeSeconds !== null && (
              <div className="bg-secondary rounded-lg px-3.5 py-2.5 inline-flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground">Baseline finish time:</span>
                <span className="text-base font-bold text-foreground tabular-nums">
                  {formatTime(originalTimeSeconds)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center gap-2.5 flex-wrap">
              <div className="relative flex-none">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  type="text"
                  placeholder="Search shoes..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); }}
                  className="w-[220px] pl-8"
                />
              </div>
              <div className="flex gap-1.5">
                {tierFilterOptions.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={selectedTier === opt.value ? "default" : "secondary"}
                    size="sm"
                    onClick={() => { setSelectedTier(opt.value); }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2.5">
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetAllFilters}
                  >
                    <X size={12} />
                    Reset filters
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  Showing {filteredShoes.length} of {shoes.length} shoes
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {allBrands.map((brand) => {
                const isActive = selectedBrands.has(brand);
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => { toggleBrand(brand); }}
                    className={cn(
                      "text-xs px-2.5 py-0.5 rounded-full border cursor-pointer font-semibold",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                  >
                    {brand}
                  </button>
                );
              })}
              {selectedBrands.size > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelectedBrands(new Set()); }}
                  className="text-xs px-2.5 py-0.5 rounded-full border cursor-pointer border-border bg-transparent text-muted-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="mb-3 flex items-center gap-3">
            <Button
              type="button"
              variant={compareMode ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setCompareMode((v) => !v);
                setCompare({ shoeAId: null, shoeBId: null });
              }}
            >
              Compare Shoes
            </Button>
            {compareMode && (
              <span className="text-xs text-muted-foreground">
                Select two shoes from the table to compare
              </span>
            )}
          </div>
        )}

        {compareMode && (compareResultA !== null || compareResultB !== null) && (
          <Card className="mb-4">
            <CardContent className="pt-4 flex gap-5 flex-wrap">
              {[compareResultA, compareResultB].map((r, idx) => (
                <div key={idx} className="flex-1 min-w-[200px]">
                  <div className="text-xs text-muted-foreground mb-1">Shoe {String.fromCharCode(65 + idx)}</div>
                  {r !== null && r !== undefined ? (
                    <>
                      <div className="text-[15px] font-bold text-foreground">{r.shoe.name}</div>
                      <div className="text-[13px] text-muted-foreground">{r.shoe.brand}</div>
                      <div className="text-sm text-success mt-1.5">
                        -{formatTime(r.timeSaved)} saved
                      </div>
                      <div className="text-sm text-foreground font-semibold">
                        Finish: {formatTime(r.projectedTime)}
                      </div>
                    </>
                  ) : (
                    <div className="text-[13px] text-muted-foreground">Not selected</div>
                  )}
                </div>
              ))}
              {compareResultA !== null && compareResultA !== undefined && compareResultB !== null && compareResultB !== undefined && (
                <div className="flex-1 min-w-[160px] border-l border-border pl-5">
                  <div className="text-xs text-muted-foreground mb-1">Difference</div>
                  <div className="text-[15px] font-bold text-primary">
                    {formatTime(Math.abs(compareResultA.timeSaved - compareResultB.timeSaved))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {compareResultA.timeSaved > compareResultB.timeSaved
                      ? `${compareResultA.shoe.name} is faster`
                      : `${compareResultB.shoe.name} is faster`}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card className="mb-5 overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-foreground m-0">
                Results — {results.length} shoes
              </h2>
            </div>
            <Table className="table-fixed">
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "16%" }} />
                  {compareMode && <col style={{ width: "6%" }} />}
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-card">
                    {["Shoe", "Tier", "Carbon", "Benefit", "Time Saved", "Finish Time"].map((h) => (
                      <TableHead
                        key={h}
                        className="p-2.5 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border"
                      >
                        {h}
                      </TableHead>
                    ))}
                    {compareMode && (
                      <TableHead className="p-2.5 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                        Pick
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => {
                    const isSelectedForCompare = compare.shoeAId === r.shoe.id || compare.shoeBId === r.shoe.id;
                    return (
                      <TableRow
                        key={r.shoe.id}
                        className={cn(
                          "border-b border-border",
                          isSelectedForCompare
                            ? "bg-accent"
                            : i % 2 === 0
                            ? "bg-background"
                            : "bg-card"
                        )}
                      >
                        <TableCell className="p-2.5 px-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-[13px] font-semibold text-foreground">
                                {r.shoe.name}
                                {r.shoe.isCustom === true && (
                                  <Badge className="ml-1.5 text-[10px] bg-primary/10 text-primary">
                                    custom
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{r.shoe.brand}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-2.5 px-4 text-sm">
                          <TierBadge tier={r.shoe.tier} />
                        </TableCell>
                        <TableCell className="p-2.5 px-4 text-sm">
                          {r.shoe.hasCarbonPlate ? (
                            <span className="text-primary text-[13px] font-semibold">Yes</span>
                          ) : (
                            <span className="text-muted-foreground text-[13px]">No</span>
                          )}
                        </TableCell>
                        <TableCell className="p-2.5 px-4 text-sm text-muted-foreground tabular-nums">
                          {r.shoe.speedBenefitPercent.toFixed(1)}%
                        </TableCell>
                        <TableCell className="p-2.5 px-4 text-sm font-semibold text-success tabular-nums">
                          -{formatTime(r.timeSaved)}
                        </TableCell>
                        <TableCell className="p-2.5 px-4 text-sm font-bold text-foreground tabular-nums">
                          {formatTime(r.projectedTime)}
                        </TableCell>
                        {compareMode && (
                          <TableCell className="p-2.5 px-4 text-sm">
                            <Button
                              type="button"
                              variant={isSelectedForCompare ? "default" : "secondary"}
                              size="xs"
                              onClick={() => {
                                setCompare((prev) => {
                                  if (prev.shoeAId === r.shoe.id) return { ...prev, shoeAId: null };
                                  if (prev.shoeBId === r.shoe.id) return { ...prev, shoeBId: null };
                                  if (prev.shoeAId === null) return { ...prev, shoeAId: r.shoe.id };
                                  if (prev.shoeBId === null) return { ...prev, shoeBId: r.shoe.id };
                                  return prev;
                                });
                              }}
                            >
                              {isSelectedForCompare ? "Remove" : "Add"}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          </Card>
        )}

        {originalTimeSeconds === null && (
          <Card className="mb-5">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Zap size={32} className="mx-auto mb-3 block opacity-40" />
              <div className="text-sm">Enter a distance and pace above to see shoe comparisons</div>
            </CardContent>
          </Card>
        )}

        {originalTimeSeconds !== null && results.length === 0 && (
          <Card className="mb-5">
            <CardContent className="py-8 text-center text-muted-foreground">
              <div className="text-sm">No shoes match your current filters</div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden p-0">
          <Accordion>
            <AccordionItem value="custom-shoe">
              <AccordionTrigger
                className="px-5 py-4 text-[15px] font-semibold text-foreground hover:no-underline [&>svg[data-slot=accordion-trigger-icon]]:hidden"
              >
                <Plus size={16} className="text-primary shrink-0" />
                <span className="ml-2">Add Custom Shoe</span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 border-t border-border">
                <div className="pt-4 grid grid-cols-2 gap-3.5">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 font-medium">
                      Shoe Name *
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. My Custom Racer"
                      value={customName}
                      onChange={(e) => { setCustomName(e.target.value); if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined })); }}
                      className={cn(formErrors.name ? "border-destructive" : "border-border")}
                    />
                    {formErrors.name && (
                      <div className="text-xs text-destructive mt-1">{formErrors.name}</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 font-medium">
                      Brand
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. Brooks"
                      value={customBrand}
                      onChange={(e) => { setCustomBrand(e.target.value); }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 font-medium">
                      Stack Height (mm) *
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="80"
                      placeholder="e.g. 36"
                      value={customStack}
                      onChange={(e) => { setCustomStack(e.target.value); if (formErrors.stack) setFormErrors((prev) => ({ ...prev, stack: undefined })); }}
                      className={cn(formErrors.stack ? "border-destructive" : "border-border")}
                    />
                    {formErrors.stack && (
                      <div className="text-xs text-destructive mt-1">{formErrors.stack}</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 font-medium">
                      Speed Benefit %{" "}
                      <span className="text-muted-foreground italic font-normal">(optional — auto-estimated)</span>
                    </Label>
                    <Input
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      placeholder="e.g. 3.5"
                      value={customBenefit}
                      onChange={(e) => { setCustomBenefit(e.target.value); }}
                    />
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] text-muted-foreground">
                    <Checkbox
                      checked={customCarbon}
                      onCheckedChange={(checked: boolean | "indeterminate") => { setCustomCarbon(checked !== "indeterminate" && checked); }}
                    />
                    Carbon plate
                  </label>
                </div>

                <div className="mt-1.5 text-xs text-muted-foreground">
                  Auto-estimate guide: carbon + stack &ge;35mm &rarr; 3.5% &bull; carbon + stack &lt;35mm &rarr; 2.5% &bull; no carbon + stack &ge;35mm &rarr; 1.2% &bull; no carbon + stack &lt;35mm &rarr; 0.8%
                </div>

                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={handleAddCustomShoe}
                  >
                    Add Shoe
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        <Alert className="mb-6">
          <Info className="size-4" />
          <AlertDescription>
            <h3 className="text-sm font-bold text-foreground mb-2">
              Speed Benefit Percentage
            </h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Each shoe in this calculator has a speed benefit percentage representing how much faster you would finish
              a race compared to running in a basic, non-technical shoe. These values are derived from published
              biomechanics research and lab-tested shoe data. A 4% benefit means you would finish approximately
              4% faster — roughly 7 minutes saved on a 3-hour marathon.
            </p>

            <h3 className="text-sm font-bold text-foreground mb-2">
              The Science
            </h3>
            <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
              The landmark 2017 University of Colorado study (Hoogkamer et al.) found Nike Vaporfly shoes improved
              running economy by approximately 4% on average, with individual responses ranging from 1.6% to 6.3%.
              A 2026 meta-analysis of 14 studies covering 271 runners (Kobayashi et al.) confirmed that carbon-plated
              shoes reduce the metabolic cost of running by 2 to 3% on average.
            </p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              The benefits come from three factors working together: advanced PEBA foam (ZoomX, LightStrike Pro,
              PWRRUN HG) with 80-87% energy return versus 60-65% for standard EVA foam; a stiff carbon fiber plate
              that acts as a lever to propel the foot forward; and a rocker geometry that promotes an efficient
              forward rolling motion through the gait cycle.
            </p>

            <h3 className="text-sm font-bold text-foreground mb-2">
              How We Calculate
            </h3>
            <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
              Time saved is calculated as:
            </p>
            <div className="bg-secondary border border-border rounded-md px-3.5 py-2.5 font-mono text-sm text-foreground mb-2">
              time_saved = baseline_time &times; (benefit% / (100 + benefit%))
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              This formula accounts for the fact that a faster pace means less total time spent running, so the
              absolute saving is slightly less than a simple percentage of the original time. For example, a 4%
              benefit on a 3:00:00 marathon saves approximately 6 minutes 55 seconds — not 7 minutes 12 seconds —
              because you are also spending less time running at the improved pace.
            </p>

            <h3 className="text-sm font-bold text-foreground mb-2">
              What Affects the Rating
            </h3>
            <div className="text-sm text-muted-foreground leading-relaxed mb-4">
              <div className="mb-1.5">
                <span className="font-semibold text-foreground">Carbon plate presence</span>
                {" — "}the biggest single factor, contributing +2 to 3% on its own.
              </div>
              <div className="mb-1.5">
                <span className="font-semibold text-foreground">Foam technology</span>
                {" — "}PEBA foam (ZoomX, LightStrike Pro) adds roughly 1.5 to 2%; standard TPU adds 0.5 to 1%;
                traditional EVA adds negligible benefit.
              </div>
              <div className="mb-1.5">
                <span className="font-semibold text-foreground">Stack height</span>
                {" — "}more foam means more stored energy. The optimal range for carbon racing shoes is 35 to 40mm.
                Very high stacks (45mm+) can reduce efficiency due to instability.
              </div>
              <div className="mb-1.5">
                <span className="font-semibold text-foreground">Shoe weight</span>
                {" — "}every 100g reduction in shoe mass improves running economy by approximately 1%.
              </div>
              <div>
                <span className="font-semibold text-foreground">Rocker geometry</span>
                {" — "}the curvature of the sole affects forward propulsion. Benefits vary by individual
                biomechanics and cadence.
              </div>
            </div>

            <h3 className="text-sm font-bold text-foreground mb-2">
              Limitations
            </h3>
            <div className="text-sm text-muted-foreground leading-relaxed mb-4">
              <div className="mb-1.5">
                Individual results vary significantly. Some runners respond much more strongly to super shoes
                than others, depending on running mechanics, cadence, and foot strike pattern.
              </div>
              <div className="mb-1.5">
                Published studies measure benefits in controlled lab conditions. Real-world race gains may differ
                due to terrain, weather, fatigue, and pacing strategy.
              </div>
              <div className="mb-1.5">
                PEBA foam degrades after roughly 400 to 500 km of use. Traditional EVA foam maintains performance
                characteristics longer, typically 600 to 800 km.
              </div>
              <div>
                Most research focuses on flat road running at race pace. Trail shoes and ultra-distance running
                show different benefit patterns due to terrain variability and slower paces.
              </div>
            </div>

            <h3 className="text-sm font-bold text-foreground mb-2">
              Sources
            </h3>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <div>Hoogkamer et al. (2017) — Original Vaporfly 4% study, Sports Medicine</div>
              <div>Kobayashi et al. (2026) — Carbon plate meta-analysis (14 studies, 271 runners), Frontiers in Sports</div>
              <div>Bolliger et al. (2026) — Speed-independent benefits of carbon-plated shoes, Sports Medicine Open</div>
              <div>RunRepeat shoe database — 700+ shoes lab-tested for running economy</div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
