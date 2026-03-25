import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, X, Calendar, List, ChevronLeft, ChevronRight } from "lucide-react";
import type { Race, TrainingPlan, PlanSession, PlanWeekWithSessions } from "./types";
import { getSessionColor, formatPace, getWeeksToRace } from "./types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlanCalendar({ onPlanGenerated }: { onPlanGenerated: () => void }) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [planWeeks, setPlanWeeks] = useState<PlanWeekWithSessions[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"calendar" | "week">("calendar");

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const [selectedSession, setSelectedSession] = useState<PlanSession | null>(null);
  const [actualDuration, setActualDuration] = useState("");
  const [actualDistance, setActualDistance] = useState("");

  const sessionModalRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const loadedRaces = await invoke<Race[]>("list_races");
      setRaces(loadedRaces);

      try {
        const loadedPlan = await invoke<TrainingPlan>("get_active_plan");
        setPlan(loadedPlan);
        const weeks = await invoke<PlanWeekWithSessions[]>("get_plan_weeks", { planId: loadedPlan.id });
        setPlanWeeks(weeks);
      } catch {
        setPlan(null);
        setPlanWeeks([]);
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const state = { cancelled: false };
    let cleanup: (() => void) | undefined;
    void (async () => {
      const fn = await listen("plan:generate:complete", () => {
        if (state.cancelled) return;
        void loadData();
        onPlanGenerated();
      });
      if (state.cancelled) {
        fn();
      } else {
        cleanup = fn;
      }
    })();
    return () => { state.cancelled = true; cleanup?.(); };
  }, [loadData, onPlanGenerated]);

  const handleUpdateSession = async (status: string) => {
    if (!selectedSession) return;
    try {
      await invoke("update_session_status", {
        sessionId: selectedSession.id,
        status: {
          status,
          actual_duration_min: actualDuration ? parseFloat(actualDuration) : null,
          actual_distance_km: actualDistance ? parseFloat(actualDistance) : null,
        },
      });
      setSelectedSession(null);
      if (plan) {
        const weeks = await invoke<PlanWeekWithSessions[]>("get_plan_weeks", { planId: plan.id });
        setPlanWeeks(weeks);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const openSessionModal = (session: PlanSession) => {
    lastFocusedRef.current = document.activeElement as HTMLElement;
    setSelectedSession(session);
    setActualDuration(session.actual_duration_min?.toString() ?? "");
    setActualDistance(session.actual_distance_km?.toString() ?? "");
  };

  useEffect(() => {
    if (!selectedSession || !sessionModalRef.current) return;
    const modal = sessionModalRef.current;
    modal.focus();
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement | undefined;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement | undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSession(null);
        lastFocusedRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    modal.addEventListener("keydown", handleKeyDown);
    return () => { modal.removeEventListener("keydown", handleKeyDown); };
  }, [selectedSession]);

  const getCurrentWeekIndex = (): number => {
    if (planWeeks.length === 0) return 0;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < planWeeks.length; i++) {
      const start = new Date(planWeeks[i].week.week_start).getTime();
      if (start <= now && now < start + weekMs) return i;
    }
    for (let i = 0; i < planWeeks.length; i++) {
      const start = new Date(planWeeks[i].week.week_start).getTime();
      if (start > now) return i;
    }
    return planWeeks.length - 1;
  };

  const getCurrentWeek = (): PlanWeekWithSessions | null => {
    if (planWeeks.length === 0) return null;
    const idx = selectedWeekIndex ?? getCurrentWeekIndex();
    return planWeeks[idx] ?? null;
  };

  const getMonthGroups = (): { label: string; weeks: PlanWeekWithSessions[] }[] => {
    const groups: Map<string, PlanWeekWithSessions[]> = new Map();
    for (const pw of planWeeks) {
      const d = new Date(pw.week.week_start);
      const key = `${String(d.getFullYear())}-${String(d.getMonth())}`;
      const existing = groups.get(key) ?? [];
      existing.push(pw);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).map(([, weeks]) => {
      const d = new Date(weeks[0].week.week_start);
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      return { label, weeks };
    });
  };

  if (!plan) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 24 }}>
        <div className="empty-state">
          <Calendar size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p>No active training plan.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Create one from the My Plans tab.</p>
        </div>
      </div>
    );
  }

  const activeRace = races.find(r => r.is_active);
  const monthGroups = getMonthGroups();
  const clampedMonthOffset = Math.min(monthOffset, Math.max(0, monthGroups.length - 1));

  const renderViewToggle = () => (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        className={calendarView === "calendar" ? "btn-primary" : "btn-secondary"}
        onClick={() => { setCalendarView("calendar"); }}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px" }}
        title="Calendar view"
      >
        <Calendar size={14} />
      </button>
      <button
        className={calendarView === "week" ? "btn-primary" : "btn-secondary"}
        onClick={() => { setCalendarView("week"); }}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px" }}
        title="Weekly view"
      >
        <List size={14} />
      </button>
    </div>
  );

  const renderWeekNav = () => {
    const currentIdx = selectedWeekIndex ?? getCurrentWeekIndex();
    const isAuto = selectedWeekIndex === null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          className="btn-secondary"
          onClick={() => { setSelectedWeekIndex(Math.max(0, currentIdx - 1)); }}
          disabled={currentIdx <= 0}
          style={{ padding: "6px 10px" }}
          title="Previous week"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          className={isAuto ? "btn-primary" : "btn-secondary"}
          onClick={() => { setSelectedWeekIndex(null); }}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          Today
        </button>
        <button
          className="btn-secondary"
          onClick={() => { setSelectedWeekIndex(Math.min(planWeeks.length - 1, currentIdx + 1)); }}
          disabled={currentIdx >= planWeeks.length - 1}
          style={{ padding: "6px 10px" }}
          title="Next week"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  };

  const renderMonthNav = () => {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          className="btn-secondary"
          onClick={() => { setMonthOffset(o => Math.max(0, o - 1)); }}
          disabled={clampedMonthOffset <= 0}
          style={{ padding: "6px 10px" }}
          title="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        {monthGroups[clampedMonthOffset] && (
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: "center" }}>
            {monthGroups[clampedMonthOffset].label}
          </span>
        )}
        <button
          className="btn-secondary"
          onClick={() => { setMonthOffset(o => Math.min(monthGroups.length - 1, o + 1)); }}
          disabled={clampedMonthOffset >= monthGroups.length - 1}
          style={{ padding: "6px 10px" }}
          title="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const weeksToRender = monthGroups[clampedMonthOffset]?.weeks ?? [];

    return (
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <div style={{ minWidth: 800 }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
            <div style={{ padding: 12, fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Wk</div>
            {DAY_NAMES.map(day => (
              <div key={day} style={{ padding: 12, fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{day}</div>
            ))}
          </div>

          {weeksToRender.map((pw) => {
            const isPast = new Date(pw.week.week_start).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000;
            const plannedKm = pw.sessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
            const actualKm = pw.sessions.reduce((sum, s) => sum + (s.actual_distance_km ?? 0), 0);

            return (
              <div key={pw.week.id} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--border)", opacity: isPast ? 0.6 : 1 }}>
                <div style={{ padding: 12, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontWeight: 700 }}>{pw.week.week_number}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{actualKm.toFixed(0)}/{plannedKm.toFixed(0)}km</div>
                </div>

                {[1, 2, 3, 4, 5, 6, 7].map(day => {
                  const session = pw.sessions.find(s => s.day_of_week === day);
                  if (!session) return <div key={day} style={{ padding: 8, borderRight: "1px solid var(--border)" }} />;

                  const color = getSessionColor(session.session_type);
                  const isCompleted = session.status === "completed";
                  const isSkipped = session.status === "skipped";

                  return (
                    <div key={day} style={{ padding: 8, borderRight: "1px solid var(--border)" }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { openSessionModal(session); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSessionModal(session); } }}
                        style={{
                          background: isCompleted ? "var(--bg-tertiary)" : isSkipped ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                          border: `1px solid ${isCompleted ? color : isSkipped ? "var(--border)" : "var(--border)"}`,
                          borderRadius: "var(--radius-sm)",
                          padding: 8,
                          cursor: "pointer",
                          height: "100%",
                          opacity: isSkipped ? 0.5 : 1,
                          position: "relative",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: isSkipped ? "var(--text-muted)" : color, textTransform: "uppercase", marginBottom: 4 }}>
                          {session.session_type.replace("_", " ")}
                        </div>
                        {session.distance_km && <div style={{ fontSize: 13, fontWeight: 500 }}>{session.distance_km} km</div>}
                        {session.duration_min && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{session.duration_min} min</div>}

                        {isCompleted && <Check size={14} style={{ position: "absolute", top: 6, right: 6, color }} />}
                        {isSkipped && <X size={14} style={{ position: "absolute", top: 6, right: 6, color: "var(--text-muted)" }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {weeksToRender.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No training weeks in this month.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeeklyOverview = () => {
    const currentWeek = getCurrentWeek();
    if (!currentWeek) {
      return (
        <div className="empty-state">
          <p>No weeks in this plan.</p>
        </div>
      );
    }

    const weekStart = new Date(currentWeek.week.week_start);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const plannedKm = currentWeek.sessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);

    const formatDateShort = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Week {currentWeek.week.week_number}</h2>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {formatDateShort(weekStart)} - {formatDateShort(weekEnd)} &bull; {plannedKm.toFixed(1)} km planned
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7].map(day => {
            const session = currentWeek.sessions.find(s => s.day_of_week === day);
            if (!session) {
              return (
                <div key={day} className="card" style={{ padding: "12px 16px", opacity: 0.5 }}>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{DAY_NAMES[day - 1]} &mdash; Rest</div>
                </div>
              );
            }

            const color = getSessionColor(session.session_type);
            const isCompleted = session.status === "completed";
            const isSkipped = session.status === "skipped";

            return (
              <div
                key={day}
                className="card"
                role="button"
                tabIndex={0}
                onClick={() => { openSessionModal(session); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSessionModal(session); } }}
                style={{
                  borderLeft: `4px solid ${color}`,
                  cursor: "pointer",
                  opacity: isSkipped ? 0.5 : 1,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{DAY_NAMES[day - 1]}</span>
                      <span style={{ background: "var(--bg-tertiary)", color, padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                         {session.session_type.replace("_", " ")}
                       </span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, marginTop: 6 }}>
                      {session.distance_km && <span style={{ fontWeight: 500 }}>{session.distance_km} km</span>}
                      {session.duration_min && <span style={{ color: "var(--text-secondary)" }}>{session.duration_min} min</span>}
                      {session.hr_zone && <span style={{ color: "var(--text-secondary)" }}>Z{session.hr_zone}</span>}
                      {(session.pace_min_low ?? session.pace_min_high) && (
                        <span style={{ color: "var(--text-secondary)" }}>{formatPace(session.pace_min_low, session.pace_min_high)}</span>
                      )}
                    </div>
                    {session.notes && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                        {session.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {isCompleted && (
                      <>
                        <Check size={14} style={{ color: "var(--success)" }} />
                        <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>Completed</span>
                      </>
                    )}
                    {isSkipped && (
                      <>
                        <X size={14} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Skipped</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTrainingVisualization = (session: PlanSession) => {
    const color = getSessionColor(session.session_type);
    const duration = session.duration_min ?? 40;

    if (session.session_type === "rest") {
      return (
        <div style={{ padding: "12px 0", marginBottom: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          Rest Day
        </div>
      );
    }

    interface Segment { label: string; pct: number; color: string; min: number }
    let segments: Segment[] = [];

    if (session.session_type === "tempo") {
      const warmup = Math.round(duration * 0.15);
      const work = Math.round(duration * 0.70);
      const cooldown = duration - warmup - work;
      segments = [
        { label: `Warmup\n${String(warmup)}min`, pct: 15, color: "var(--bg-hover)", min: warmup },
        { label: `Tempo\n${String(work)}min`, pct: 70, color, min: work },
        { label: `Cooldown\n${String(cooldown)}min`, pct: 15, color: "var(--bg-hover)", min: cooldown },
      ];
    } else if (session.session_type === "intervals") {
      const segCount = duration >= 60 ? 8 : 6;
      const segDuration = Math.round(duration / segCount);
      segments = Array.from({ length: segCount }, (_, i) => ({
        label: i % 2 === 0 ? `Hard\n${String(segDuration)}min` : `Rest\n${String(segDuration)}min`,
        pct: 100 / segCount,
        color: i % 2 === 0 ? color : "var(--bg-hover)",
        min: segDuration,
      }));
    } else {
      segments = [
        { label: `${session.session_type.replace("_", " ")}\n${String(duration)}min`, pct: 100, color, min: duration },
      ];
    }

    return (
      <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Workout Structure</div>
        <div style={{ display: "flex", height: 20, width: "100%", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${String(seg.pct)}%`,
                background: seg.color,
                borderRight: i < segments.length - 1 ? "1px solid var(--bg-primary)" : "none",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 6 }}>
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${String(seg.pct)}%`,
                fontSize: 10,
                color: "var(--text-muted)",
                textAlign: "center",
                whiteSpace: "pre-line",
                lineHeight: 1.3,
              }}
            >
              {seg.label.split("\n")[1]}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSessionModal = () => {
    if (!selectedSession) return null;

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => { setSelectedSession(null); lastFocusedRef.current?.focus(); }}>
        <div ref={sessionModalRef} role="dialog" aria-modal="true" aria-labelledby="session-modal-title" tabIndex={-1} className="card" style={{ width: 420, maxWidth: "90%", maxHeight: "90%", overflow: "auto" }} onClick={(e) => { e.stopPropagation(); }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 id="session-modal-title" style={{ fontSize: 18, fontWeight: 600, color: getSessionColor(selectedSession.session_type), textTransform: "capitalize" }}>
              {selectedSession.session_type.replace("_", " ")}
            </h2>
            <button className="btn-ghost" onClick={() => { setSelectedSession(null); lastFocusedRef.current?.focus(); }} aria-label="Close"><X size={20} /></button>
           </div>

           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, background: "var(--bg-tertiary)", padding: 12, borderRadius: "var(--radius-md)" }}>
             {selectedSession.distance_km && (
               <div>
                 <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Planned Distance</div>
                <div style={{ fontWeight: 500 }}>{selectedSession.distance_km} km</div>
              </div>
            )}
            {selectedSession.duration_min && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Planned Duration</div>
                <div style={{ fontWeight: 500 }}>{selectedSession.duration_min} min</div>
              </div>
            )}
            {selectedSession.hr_zone && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>HR Zone</div>
                <div style={{ fontWeight: 500 }}>Z{selectedSession.hr_zone}</div>
              </div>
            )}
            {(selectedSession.pace_min_low ?? selectedSession.pace_min_high) && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Target Pace</div>
                <div style={{ fontWeight: 500 }}>{formatPace(selectedSession.pace_min_low, selectedSession.pace_min_high)}</div>
              </div>
            )}
          </div>

          {renderTrainingVisualization(selectedSession)}

          {selectedSession.notes && (
            <div style={{ marginBottom: 20 }}>
               <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Coach Notes</div>
               <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-tertiary)", padding: 12, borderRadius: "var(--radius-md)" }}>
                 {selectedSession.notes}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={() => { void handleUpdateSession("skipped"); }} style={{ flex: 1 }}>Mark Skipped</button>
            <button className="btn-primary" onClick={() => { void handleUpdateSession("completed"); }} style={{ flex: 2, background: "var(--success)" }}>Mark Completed</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Training Plan</h1>
          {activeRace && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{activeRace.name} &bull; {getWeeksToRace(activeRace.race_date)} weeks to go</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {calendarView === "week" && renderWeekNav()}
          {calendarView === "calendar" && renderMonthNav()}
          {renderViewToggle()}
        </div>
      </div>

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      {calendarView === "calendar" && renderCalendarGrid()}
      {calendarView === "week" && renderWeeklyOverview()}
      {renderSessionModal()}
    </div>
  );
}
