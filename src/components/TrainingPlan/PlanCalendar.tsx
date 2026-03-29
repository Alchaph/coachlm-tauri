import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, X, Calendar, List, ChevronLeft, ChevronRight } from "lucide-react";
import type { Race, TrainingPlan, PlanSession, PlanWeekWithSessions } from "./types";
import { getSessionColor, formatPace, getWeeksToRace } from "./types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

  const loadData = useCallback(async () => {
    try {
      const loadedRaces = await invoke<Race[]>("list_races");
      setRaces(loadedRaces);

      try {
        const loadedPlan = await invoke<TrainingPlan | null>("get_active_plan");
        if (loadedPlan) {
          setPlan(loadedPlan);
          const weeks = await invoke<PlanWeekWithSessions[]>("get_plan_weeks", { planId: loadedPlan.id });
          setPlanWeeks(weeks);
        } else {
          setPlan(null);
          setPlanWeeks([]);
        }
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
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Calendar size={48} className="mx-auto mb-4 opacity-30" />
          <p>No active training plan.</p>
          <p className="text-xs mt-2">Create one from the My Plans tab.</p>
        </div>
      </div>
    );
  }

  const activeRace = races.find(r => r.is_active);
  const monthGroups = getMonthGroups();
  const clampedMonthOffset = Math.min(monthOffset, Math.max(0, monthGroups.length - 1));

  const renderViewToggle = () => (
    <div className="flex gap-1">
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant={calendarView === "calendar" ? "default" : "secondary"}
            size="sm"
            onClick={() => { setCalendarView("calendar"); }}
            aria-label="Calendar view"
          >
            <Calendar size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Calendar view</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant={calendarView === "week" ? "default" : "secondary"}
            size="sm"
            onClick={() => { setCalendarView("week"); }}
            aria-label="Weekly view"
          >
            <List size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Weekly view</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderWeekNav = () => {
    const currentIdx = selectedWeekIndex ?? getCurrentWeekIndex();
    const isAuto = selectedWeekIndex === null;
    return (
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setSelectedWeekIndex(Math.max(0, currentIdx - 1)); }}
              disabled={currentIdx <= 0}
              aria-label="Previous week"
            >
              <ChevronLeft size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous week</TooltipContent>
        </Tooltip>
        <Button
          variant={isAuto ? "default" : "secondary"}
          size="sm"
          onClick={() => { setSelectedWeekIndex(null); }}
        >
          Today
        </Button>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setSelectedWeekIndex(Math.min(planWeeks.length - 1, currentIdx + 1)); }}
              disabled={currentIdx >= planWeeks.length - 1}
              aria-label="Next week"
            >
              <ChevronRight size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next week</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const renderMonthNav = () => {
    return (
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setMonthOffset(o => Math.max(0, o - 1)); }}
              disabled={clampedMonthOffset <= 0}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous month</TooltipContent>
        </Tooltip>
        {monthGroups[clampedMonthOffset] && (
          <span className="text-[13px] font-semibold min-w-[130px] text-center">
            {monthGroups[clampedMonthOffset].label}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setMonthOffset(o => Math.min(monthGroups.length - 1, o + 1)); }}
              disabled={clampedMonthOffset >= monthGroups.length - 1}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next month</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const weeksToRender = monthGroups[clampedMonthOffset]?.weeks ?? [];

    return (
      <Card className="p-0 overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-secondary">
            <div className="p-3 font-semibold text-xs text-muted-foreground text-center">Wk</div>
            {DAY_NAMES.map(day => (
              <div key={day} className="p-3 font-semibold text-xs text-muted-foreground text-center">{day}</div>
            ))}
          </div>

          {weeksToRender.map((pw) => {
            const isPast = new Date(pw.week.week_start).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000;
            const plannedKm = pw.sessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
            const actualKm = pw.sessions.reduce((sum, s) => sum + (s.actual_distance_km ?? 0), 0);

            return (
              <div
                key={pw.week.id}
                className={cn(
                  "grid grid-cols-[60px_repeat(7,1fr)] border-b border-border",
                  isPast && "opacity-60"
                )}
              >
                <div className="p-3 border-r border-border flex flex-col items-center justify-center">
                  <div className="font-bold">{pw.week.week_number}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{actualKm.toFixed(0)}/{plannedKm.toFixed(0)}km</div>
                </div>

                {[1, 2, 3, 4, 5, 6, 7].map(day => {
                  const session = pw.sessions.find(s => s.day_of_week === day);
                  if (!session) return <div key={day} className="p-2 border-r border-border" />;

                  const color = getSessionColor(session.session_type);
                  const isCompleted = session.status === "completed";
                  const isSkipped = session.status === "skipped";

                  return (
                    <div key={day} className="p-2 border-r border-border">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedSession(session);
                          setActualDuration(session.actual_duration_min?.toString() ?? "");
                          setActualDistance(session.actual_distance_km?.toString() ?? "");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSession(session);
                            setActualDuration(session.actual_duration_min?.toString() ?? "");
                            setActualDistance(session.actual_distance_km?.toString() ?? "");
                          }
                        }}
                        className={cn(
                          "rounded-sm p-2 cursor-pointer h-full relative",
                          "border",
                          isCompleted ? "bg-secondary border-current" : isSkipped ? "bg-secondary border-border" : "bg-card border-border",
                          isSkipped && "opacity-50"
                        )}
                        style={{ borderColor: isCompleted ? color : undefined }}
                      >
                        <div
                          className="text-[11px] font-semibold uppercase mb-1"
                          style={{ color: isSkipped ? undefined : color }}
                        >
                          {isSkipped ? <span className="text-muted-foreground">{session.session_type.replace("_", " ")}</span> : session.session_type.replace("_", " ")}
                        </div>
                        {session.distance_km && <div className="text-[13px] font-medium">{session.distance_km} km</div>}
                        {session.duration_min && <div className="text-xs text-muted-foreground">{session.duration_min} min</div>}

                        {isCompleted && <Check size={14} className="absolute top-1.5 right-1.5" style={{ color }} />}
                        {isSkipped && <X size={14} className="absolute top-1.5 right-1.5 text-muted-foreground" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {weeksToRender.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-[13px]">
              No training weeks in this month.
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderWeeklyOverview = () => {
    const currentWeek = getCurrentWeek();
    if (!currentWeek) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
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
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base font-semibold">Week {currentWeek.week.week_number}</h2>
            <div className="text-[13px] text-muted-foreground">
              {formatDateShort(weekStart)} - {formatDateShort(weekEnd)} &bull; {plannedKm.toFixed(1)} km planned
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7].map(day => {
            const session = currentWeek.sessions.find(s => s.day_of_week === day);
            if (!session) {
              return (
                <Card key={day} className="px-4 py-3 opacity-50">
                  <div className="text-[13px] text-muted-foreground">{DAY_NAMES[day - 1]} &mdash; Rest</div>
                </Card>
              );
            }

            const color = getSessionColor(session.session_type);
            const isCompleted = session.status === "completed";
            const isSkipped = session.status === "skipped";

            return (
              <Card
                key={day}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedSession(session);
                  setActualDuration(session.actual_duration_min?.toString() ?? "");
                  setActualDistance(session.actual_distance_km?.toString() ?? "");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSession(session);
                    setActualDuration(session.actual_duration_min?.toString() ?? "");
                    setActualDistance(session.actual_distance_km?.toString() ?? "");
                  }
                }}
                className={cn(
                  "px-4 py-3 cursor-pointer transition-colors",
                  isSkipped && "opacity-50"
                )}
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] text-muted-foreground">{DAY_NAMES[day - 1]}</span>
                      <span
                        className="bg-secondary px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase"
                        style={{ color }}
                      >
                        {session.session_type.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm mt-1.5">
                      {session.distance_km && <span className="font-medium">{session.distance_km} km</span>}
                      {session.duration_min && <span className="text-muted-foreground">{session.duration_min} min</span>}
                      {session.hr_zone && <span className="text-muted-foreground">Z{session.hr_zone}</span>}
                      {(session.pace_min_low ?? session.pace_min_high) && (
                        <span className="text-muted-foreground">{formatPace(session.pace_min_low, session.pace_min_high)}</span>
                      )}
                    </div>
                    {session.notes && (
                      <div className="text-xs text-muted-foreground mt-1.5 leading-snug">
                        {session.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCompleted && (
                      <>
                        <Check size={14} className="text-success" />
                        <span className="text-[11px] text-success font-medium">Completed</span>
                      </>
                    )}
                    {isSkipped && (
                      <>
                        <X size={14} className="text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground font-medium">Skipped</span>
                      </>
                    )}
                  </div>
                </div>
              </Card>
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
        <div className="py-3 mb-5 text-muted-foreground text-[13px] text-center border-t border-b border-border">
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
      <div className="mb-5 pt-4 border-t border-border">
        <div className="text-xs font-semibold mb-2.5 text-muted-foreground">Workout Structure</div>
        <div className="flex h-5 w-full rounded-sm overflow-hidden">
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${String(seg.pct)}%`,
                background: seg.color,
                borderRight: i < segments.length - 1 ? "1px solid var(--background)" : "none",
              }}
            />
          ))}
        </div>
        <div className="flex mt-1.5">
          {segments.map((seg, i) => (
            <div
              key={i}
              className="text-[10px] text-muted-foreground text-center leading-snug"
              style={{ width: `${String(seg.pct)}%` }}
            >
              {seg.label.split("\n")[1]}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold">Training Plan</h1>
          {activeRace && (
            <div className="text-[13px] text-muted-foreground">
              {activeRace.name} &bull; {getWeeksToRace(activeRace.race_date)} weeks to go
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {calendarView === "week" && renderWeekNav()}
          {calendarView === "calendar" && renderMonthNav()}
          {renderViewToggle()}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {calendarView === "calendar" && renderCalendarGrid()}
      {calendarView === "week" && renderWeeklyOverview()}

      <Dialog open={selectedSession !== null} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent className="max-w-md">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle
                  className="capitalize text-lg font-semibold"
                  style={{ color: getSessionColor(selectedSession.session_type) }}
                >
                  {selectedSession.session_type.replace("_", " ")}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 bg-secondary p-3 rounded-lg mb-5">
                {selectedSession.distance_km && (
                  <div>
                    <div className="text-xs text-muted-foreground">Planned Distance</div>
                    <div className="font-medium">{selectedSession.distance_km} km</div>
                  </div>
                )}
                {selectedSession.duration_min && (
                  <div>
                    <div className="text-xs text-muted-foreground">Planned Duration</div>
                    <div className="font-medium">{selectedSession.duration_min} min</div>
                  </div>
                )}
                {selectedSession.hr_zone && (
                  <div>
                    <div className="text-xs text-muted-foreground">HR Zone</div>
                    <div className="font-medium">Z{selectedSession.hr_zone}</div>
                  </div>
                )}
                {(selectedSession.pace_min_low ?? selectedSession.pace_min_high) && (
                  <div>
                    <div className="text-xs text-muted-foreground">Target Pace</div>
                    <div className="font-medium">{formatPace(selectedSession.pace_min_low, selectedSession.pace_min_high)}</div>
                  </div>
                )}
              </div>

              {renderTrainingVisualization(selectedSession)}

              {selectedSession.notes && (
                <div className="mb-5">
                  <div className="text-xs font-semibold mb-1">Coach Notes</div>
                  <div className="bg-secondary p-3 rounded-lg text-sm text-muted-foreground">
                    {selectedSession.notes}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Actual Distance (km)</div>
                  <Input
                    type="number"
                    value={actualDistance}
                    onChange={(e) => { setActualDistance(e.target.value); }}
                    placeholder="km"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Actual Duration (min)</div>
                  <Input
                    type="number"
                    value={actualDuration}
                    onChange={(e) => { setActualDuration(e.target.value); }}
                    placeholder="min"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { void handleUpdateSession("skipped"); }}
                >
                  Mark Skipped
                </Button>
                <Button
                  className="flex-[2] bg-success hover:bg-success/90"
                  onClick={() => { void handleUpdateSession("completed"); }}
                >
                  Mark Completed
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
