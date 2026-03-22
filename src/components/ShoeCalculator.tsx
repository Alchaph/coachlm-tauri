import { useState, useMemo } from "react";
import { Plus, ChevronDown, ChevronUp, Zap, Search, BookOpen, X } from "lucide-react";
import { useToast } from "../hooks/useToast";
import { type Shoe, BUILT_IN_SHOES } from "../data/shoes";

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

export default function ShoeCalculator() {
  const [selectedDistanceKm, setSelectedDistanceKm] = useState<number | null>(null);
  const [customDistanceStr, setCustomDistanceStr] = useState("");
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");
  const [shoes, setShoes] = useState<Shoe[]>(BUILT_IN_SHOES);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const { showToast, toastElement } = useToast();
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
  const [showHowItWorks, setShowHowItWorks] = useState(false);
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
    setShowCustomForm(false);
    showToast(`${newShoe.name} added`, "success");
  };

  const getTierStyle = (tier: "supershoe" | "racer" | "trainer"): React.CSSProperties => {
    if (tier === "supershoe") return { color: "var(--accent)", background: "var(--accent-dim)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 };
    if (tier === "racer") return { color: "var(--warning)", background: "#451a03", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 };
    return { color: "var(--text-muted)", background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 };
  };

  const tierLabel = (tier: "supershoe" | "racer" | "trainer") => {
    if (tier === "supershoe") return "Supershoe";
    if (tier === "racer") return "Racer";
    return "Trainer";
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
    <div style={{ flex: 1, overflow: "auto", padding: "24px", background: "var(--bg-primary)" }}>
      {toastElement}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Shoe Speed Calculator</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            How much faster will you finish with each shoe?
          </p>
        </div>

        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Race Setup</h2>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Distance</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESET_DISTANCES.map((d) => (
                <button
                  key={d.km}
                  type="button"
                  className={selectedDistanceKm === d.km ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: 13, padding: "6px 12px" }}
                  onClick={() => {
                    setSelectedDistanceKm(d.km);
                    setCustomDistanceStr("");
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="Custom km"
                value={customDistanceStr}
                onChange={(e) => {
                  setCustomDistanceStr(e.target.value);
                  setSelectedDistanceKm(null);
                }}
                style={{
                  width: 120,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>km</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Pace (min:sec per km)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="min"
                value={paceMinutes}
                onChange={(e) => { setPaceMinutes(e.target.value); }}
                style={{
                  width: 72,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "6px 10px",
                  fontSize: 13,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 700 }}>:</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="sec"
                value={paceSeconds}
                onChange={(e) => { setPaceSeconds(e.target.value); }}
                style={{
                  width: 72,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "6px 10px",
                  fontSize: 13,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>/km</span>
            </div>
          </div>

          {originalTimeSeconds !== null && (
            <div style={{
              background: "var(--bg-tertiary)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Baseline finish time:</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {formatTime(originalTimeSeconds)}
              </span>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 0 auto" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search shoes..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                style={{
                  width: 220,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "7px 10px 7px 30px",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {tierFilterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={selectedTier === opt.value ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => { setSelectedTier(opt.value); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <X size={12} />
                  Reset filters
                </button>
              )}
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Showing {filteredShoes.length} of {shoes.length} shoes
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allBrands.map((brand) => {
              const isActive = selectedBrands.has(brand);
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => { toggleBrand(brand); }}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 12,
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                    background: isActive ? "var(--accent-dim)" : "var(--bg-tertiary)",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {brand}
                </button>
              );
            })}
            {selectedBrands.size > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedBrands(new Set()); }}
                style={{
                  fontSize: 11,
                  padding: "3px 9px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className={compareMode ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: 13, padding: "6px 12px" }}
              onClick={() => {
                setCompareMode((v) => !v);
                setCompare({ shoeAId: null, shoeBId: null });
              }}
            >
              Compare Shoes
            </button>
            {compareMode && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Select two shoes from the table to compare
              </span>
            )}
          </div>
        )}

        {compareMode && (compareResultA !== null || compareResultB !== null) && (
          <div className="card" style={{ marginBottom: 16, padding: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[compareResultA, compareResultB].map((r, idx) => (
              <div key={idx} style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Shoe {String.fromCharCode(65 + idx)}</div>
                {r !== null && r !== undefined ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{r.shoe.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.shoe.brand}</div>
                    <div style={{ fontSize: 14, color: "var(--success)", marginTop: 6 }}>
                      -{formatTime(r.timeSaved)} saved
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
                      Finish: {formatTime(r.projectedTime)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Not selected</div>
                )}
              </div>
            ))}
            {compareResultA !== null && compareResultA !== undefined && compareResultB !== null && compareResultB !== undefined && (
              <div style={{ flex: 1, minWidth: 160, borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Difference</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
                  {formatTime(Math.abs(compareResultA.timeSaved - compareResultB.timeSaved))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {compareResultA.timeSaved > compareResultB.timeSaved
                    ? `${compareResultA.shoe.name} is faster`
                    : `${compareResultB.shoe.name} is faster`}
                </div>
              </div>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="card" style={{ marginBottom: 20, overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Results — {results.length} shoes
              </h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "16%" }} />
                  {compareMode && <col style={{ width: "6%" }} />}
                </colgroup>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["Shoe", "Tier", "Carbon", "Benefit", "Time Saved", "Finish Time"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    {compareMode && (
                      <th style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
                        Pick
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const isSelectedForCompare = compare.shoeAId === r.shoe.id || compare.shoeBId === r.shoe.id;
                    return (
                      <tr
                        key={r.shoe.id}
                        style={{
                          background: isSelectedForCompare ? "var(--bg-hover)" : i % 2 === 0 ? "var(--bg-primary)" : "var(--bg-secondary)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                {r.shoe.name}
                                {r.shoe.isCustom === true && (
                                  <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 5px", borderRadius: 3 }}>
                                    custom
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.shoe.brand}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={getTierStyle(r.shoe.tier)}>{tierLabel(r.shoe.tier)}</span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {r.shoe.hasCarbonPlate ? (
                            <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>Yes</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {r.shoe.speedBenefitPercent.toFixed(1)}%
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                          -{formatTime(r.timeSaved)}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatTime(r.projectedTime)}
                        </td>
                        {compareMode && (
                          <td style={{ padding: "10px 16px" }}>
                            <button
                              type="button"
                              className={isSelectedForCompare ? "btn-primary" : "btn-secondary"}
                              style={{ fontSize: 11, padding: "3px 8px" }}
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
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {originalTimeSeconds === null && (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", marginBottom: 20 }}>
            <Zap size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Enter a distance and pace above to see shoe comparisons</div>
          </div>
        )}

        {originalTimeSeconds !== null && results.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", marginBottom: 20 }}>
            <div style={{ fontSize: 14 }}>No shoes match your current filters</div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 24, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => { setShowCustomForm((v) => !v); setFormErrors({}); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "16px 20px",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <Plus size={16} style={{ color: "var(--accent)" }} />
            Add Custom Shoe
            <span style={{ marginLeft: "auto" }}>
              {showCustomForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showCustomForm && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
              <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Shoe Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Custom Racer"
                    value={customName}
                    onChange={(e) => { setCustomName(e.target.value); if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined })); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: `1px solid ${formErrors.name ? "var(--danger)" : "var(--border)"}`,
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                  {formErrors.name && (
                    <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{formErrors.name}</div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Brooks"
                    value={customBrand}
                    onChange={(e) => { setCustomBrand(e.target.value); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Stack Height (mm) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    placeholder="e.g. 36"
                    value={customStack}
                    onChange={(e) => { setCustomStack(e.target.value); if (formErrors.stack) setFormErrors((prev) => ({ ...prev, stack: undefined })); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: `1px solid ${formErrors.stack ? "var(--danger)" : "var(--border)"}`,
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                  {formErrors.stack && (
                    <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{formErrors.stack}</div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Speed Benefit %{" "}
                    <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>(optional — auto-estimated)</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    placeholder="e.g. 3.5"
                    value={customBenefit}
                    onChange={(e) => { setCustomBenefit(e.target.value); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={customCarbon}
                    onChange={(e) => { setCustomCarbon(e.target.checked); }}
                    style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                  />
                  Carbon plate
                </label>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                Auto-estimate guide: carbon + stack &ge;35mm &rarr; 3.5% &bull; carbon + stack &lt;35mm &rarr; 2.5% &bull; no carbon + stack &ge;35mm &rarr; 1.2% &bull; no carbon + stack &lt;35mm &rarr; 0.8%
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddCustomShoe}
                >
                  Add Shoe
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 24, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => { setShowHowItWorks((v) => !v); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "16px 20px",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <BookOpen size={16} style={{ color: "var(--accent)" }} />
            How It Works
            <span style={{ marginLeft: "auto" }}>
              {showHowItWorks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showHowItWorks && (
            <div style={{ padding: "0 24px 24px", borderTop: "1px solid var(--border)" }}>

              <div style={{ paddingTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Speed Benefit Percentage
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  Each shoe in this calculator has a speed benefit percentage representing how much faster you would finish
                  a race compared to running in a basic, non-technical shoe. These values are derived from published
                  biomechanics research and lab-tested shoe data. A 4% benefit means you would finish approximately
                  4% faster — roughly 7 minutes saved on a 3-hour marathon.
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  The Science
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.6 }}>
                  The landmark 2017 University of Colorado study (Hoogkamer et al.) found Nike Vaporfly shoes improved
                  running economy by approximately 4% on average, with individual responses ranging from 1.6% to 6.3%.
                  A 2026 meta-analysis of 14 studies covering 271 runners (Kobayashi et al.) confirmed that carbon-plated
                  shoes reduce the metabolic cost of running by 2 to 3% on average.
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  The benefits come from three factors working together: advanced PEBA foam (ZoomX, LightStrike Pro,
                  PWRRUN HG) with 80-87% energy return versus 60-65% for standard EVA foam; a stiff carbon fiber plate
                  that acts as a lever to propel the foot forward; and a rocker geometry that promotes an efficient
                  forward rolling motion through the gait cycle.
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  How We Calculate
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.6 }}>
                  Time saved is calculated as:
                </p>
                <div style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}>
                  time_saved = baseline_time &times; (benefit% / (100 + benefit%))
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  This formula accounts for the fact that a faster pace means less total time spent running, so the
                  absolute saving is slightly less than a simple percentage of the original time. For example, a 4%
                  benefit on a 3:00:00 marathon saves approximately 6 minutes 55 seconds — not 7 minutes 12 seconds —
                  because you are also spending less time running at the improved pace.
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  What Affects the Rating
                </h3>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Carbon plate presence</span>
                    {" — "}the biggest single factor, contributing +2 to 3% on its own.
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Foam technology</span>
                    {" — "}PEBA foam (ZoomX, LightStrike Pro) adds roughly 1.5 to 2%; standard TPU adds 0.5 to 1%;
                    traditional EVA adds negligible benefit.
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Stack height</span>
                    {" — "}more foam means more stored energy. The optimal range for carbon racing shoes is 35 to 40mm.
                    Very high stacks (45mm+) can reduce efficiency due to instability.
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Shoe weight</span>
                    {" — "}every 100g reduction in shoe mass improves running economy by approximately 1%.
                  </div>
                  <div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Rocker geometry</span>
                    {" — "}the curvature of the sole affects forward propulsion. Benefits vary by individual
                    biomechanics and cadence.
                  </div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Limitations
                </h3>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
                  <div style={{ marginBottom: 4 }}>
                    Individual results vary significantly. Some runners respond much more strongly to super shoes
                    than others, depending on running mechanics, cadence, and foot strike pattern.
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    Published studies measure benefits in controlled lab conditions. Real-world race gains may differ
                    due to terrain, weather, fatigue, and pacing strategy.
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    PEBA foam degrades after roughly 400 to 500 km of use. Traditional EVA foam maintains performance
                    characteristics longer, typically 600 to 800 km.
                  </div>
                  <div>
                    Most research focuses on flat road running at race pace. Trail shoes and ultra-distance running
                    show different benefit patterns due to terrain variability and slower paces.
                  </div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Sources
                </h3>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
                  <div>Hoogkamer et al. (2017) — Original Vaporfly 4% study, Sports Medicine</div>
                  <div>Kobayashi et al. (2026) — Carbon plate meta-analysis (14 studies, 271 runners), Frontiers in Sports</div>
                  <div>Bolliger et al. (2026) — Speed-independent benefits of carbon-plated shoes, Sports Medicine Open</div>
                  <div>RunRepeat shoe database — 700+ shoes lab-tested for running economy</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
