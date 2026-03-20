import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Trophy, Calendar, Check, X, RefreshCw, ChevronLeft, Pencil } from "lucide-react";

interface Race {
  id: string;
  name: string;
  distance_km: number;
  race_date: string;
  terrain: string;
  elevation_m: number | null;
  goal_time_s: number | null;
  priority: string;
  is_active: boolean;
  created_at: string;
}

interface TrainingPlan {
  id: string;
  race_id: string;
  generated_at: string;
  llm_backend: string;
  prompt_hash: string;
}

interface PlanSession {
  id: string;
  week_id: string;
  day_of_week: number;
  session_type: string;
  duration_min: number | null;
  distance_km: number | null;
  hr_zone: number | null;
  pace_min_low: number | null;
  pace_min_high: number | null;
  notes: string | null;
  status: string;
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  completed_at: string | null;
}

interface PlanWeekWithSessions {
  week: {
    id: string;
    plan_id: string;
    week_number: number;
    week_start: string;
  };
  sessions: PlanSession[];
}

export default function TrainingPlan({ onPlanChange }: { onPlanChange: (hasPlan: boolean) => void }) {
  const [view, setView] = useState<"races" | "generating" | "calendar">("races");
  const [races, setRaces] = useState<Race[]>([]);
  const [planWeeks, setPlanWeeks] = useState<PlanWeekWithSessions[]>([]);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddRace, setShowAddRace] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [raceName, setRaceName] = useState("");
  const [raceDistance, setRaceDistance] = useState<number>(21.1);
  const [raceDate, setRaceDate] = useState("");
  const [raceTerrain, setRaceTerrain] = useState("road");
  const [raceElevation, setRaceElevation] = useState<string>("");
  const [raceGoalTime, setRaceGoalTime] = useState("");
  const [racePriority, setRacePriority] = useState("A");

  const [selectedSession, setSelectedSession] = useState<PlanSession | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [actualDuration, setActualDuration] = useState("");
  const [actualDistance, setActualDistance] = useState("");

   const loadRaces = useCallback(async () => {
     try {
       const loadedRaces = await invoke<Race[]>("list_races");
       setRaces(loadedRaces);
       
       const activeRace = loadedRaces.find(r => r.is_active);
       if (activeRace) {
        try {
          const loadedPlan = await invoke<TrainingPlan>("get_active_plan");
          setPlan(loadedPlan);
          await loadPlanWeeks(loadedPlan.id);
          setView("calendar");
          onPlanChange(true);
         } catch {
           onPlanChange(false);
         }
       } else {
         onPlanChange(false);
       }
     } catch (e) {
       setError(String(e));
     }
   }, [onPlanChange]);

   useEffect(() => {
     void loadRaces();
   }, [loadRaces]);

  const loadPlanWeeks = async (planId: string) => {
    try {
      const weeks = await invoke<PlanWeekWithSessions[]>("get_plan_weeks", { planId });
      setPlanWeeks(weeks);
    } catch (e) {
      setError(String(e));
    }
  };

  const resetRaceForm = () => {
    setShowAddRace(false);
    setEditingRaceId(null);
    setRaceName("");
    setRaceDistance(21.1);
    setRaceDate("");
    setRaceTerrain("road");
    setRaceElevation("");
    setRaceGoalTime("");
    setRacePriority("A");
  };

  const formatGoalTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h)}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const startEditRace = (race: Race) => {
    setEditingRaceId(race.id);
    setShowAddRace(true);
    setRaceName(race.name);
    setRaceDistance(race.distance_km);
    setRaceDate(race.race_date);
    setRaceTerrain(race.terrain);
    setRaceElevation(race.elevation_m !== null ? String(race.elevation_m) : "");
    setRaceGoalTime(race.goal_time_s !== null ? formatGoalTime(race.goal_time_s) : "");
    setRacePriority(race.priority);
  };

  const handleSaveRace = async () => {
    if (!raceName || !raceDate) {
      setError("Name and Date are required");
      return;
    }

    if (!editingRaceId) {
      const dateObj = new Date(raceDate);
      if (dateObj < new Date()) {
        setError("Race date must be in the future");
        return;
      }
    }

    let goalTimeS: number | null = null;
    if (raceGoalTime) {
      const parts = raceGoalTime.split(":");
      if (parts.length === 3) {
        goalTimeS = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        goalTimeS = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    }

    try {
      if (editingRaceId) {
        const existingRace = races.find(r => r.id === editingRaceId);
        await invoke("update_race", {
          race: {
            id: editingRaceId,
            name: raceName,
            distance_km: raceDistance,
            race_date: raceDate,
            terrain: raceTerrain,
            elevation_m: raceElevation ? parseInt(raceElevation) : null,
            goal_time_s: goalTimeS,
            priority: racePriority,
            is_active: existingRace?.is_active ?? false,
            created_at: existingRace?.created_at ?? ""
          }
        });
      } else {
        await invoke("create_race", {
          race: {
            id: "",
            name: raceName,
            distance_km: raceDistance,
            race_date: raceDate,
            terrain: raceTerrain,
            elevation_m: raceElevation ? parseInt(raceElevation) : null,
            goal_time_s: goalTimeS,
            priority: racePriority,
            is_active: false,
            created_at: ""
          }
        });
      }
      resetRaceForm();
      void loadRaces();
    } catch (e) {
      setError(String(e));
    }
  };

   const handleSetActiveRace = async (id: string) => {
     try {
       await invoke("set_active_race", { id });
       void loadRaces();
    } catch (e) {
      setError(String(e));
    }
  };

   const handleDeleteRace = async (id: string) => {
     try {
       await invoke("delete_race", { id });
       void loadRaces();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleGeneratePlan = async (raceId: string) => {
    setView("generating");
    setError(null);
    try {
      const newPlan = await invoke<TrainingPlan>("generate_plan_cmd", { raceId });
      setPlan(newPlan);
      await loadPlanWeeks(newPlan.id);
      setView("calendar");
      onPlanChange(true);
    } catch (e) {
      setError(String(e));
      setView("races");
    }
  };

  const handleUpdateSession = async (status: string) => {
    if (!selectedSession) return;
    try {
      await invoke("update_session_status", {
        sessionId: selectedSession.id,
        status: {
          status,
          actual_duration_min: actualDuration ? parseFloat(actualDuration) : null,
          actual_distance_km: actualDistance ? parseFloat(actualDistance) : null
        }
      });
      setSelectedSession(null);
      if (plan) {
        await loadPlanWeeks(plan.id);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const getWeeksToRace = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
  };

  const getSessionColor = (type: string) => {
    switch (type) {
      case "easy": return "#22c55e";
      case "long_run": return "#3b82f6";
      case "tempo": return "#f59e0b";
      case "intervals": return "#ef4444";
      case "strength": return "#a855f7";
      case "rest": return "#64748b";
      case "race": return "#eab308";
      default: return "#64748b";
    }
  };

   const formatPace = (low: number | null, high: number | null) => {
     if (!low && !high) return "";
     const format = (p: number) => `${String(Math.floor(p))}:${Math.round((p % 1) * 60).toString().padStart(2, "0")}`;
     if (low && high) return `${format(low)} - ${format(high)}/km`;
     if (low) return `${format(low)}/km`;
     return `${format(high ?? 0)}/km`;
  };

  const renderRaceManagement = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Race Goals</h1>
        <button className="btn-primary" onClick={() => { resetRaceForm(); setShowAddRace(true); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> Add Race
        </button>
      </div>

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      {showAddRace && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{editingRaceId ? "Edit Race Goal" : "New Race Goal"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="raceName">Race Name</label>
              <input id="raceName" type="text" value={raceName} onChange={e => { setRaceName(e.target.value); }} style={{ width: "100%" }} placeholder="e.g. Berlin Marathon" />
            </div>
            <div>
              <label htmlFor="raceDate">Date</label>
              <input id="raceDate" type="date" value={raceDate} onChange={e => { setRaceDate(e.target.value); }} style={{ width: "100%" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Distance</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {[5, 10, 21.1, 42.2, 50].map(d => (
                   <button key={d} className={raceDistance === d ? "btn-primary" : "btn-secondary"} onClick={() => { setRaceDistance(d); }}>
                     {d === 21.1 ? "Half" : d === 42.2 ? "Marathon" : d === 50 ? "Ultra" : `${String(d)}K`}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input id="customDistance" type="number" value={raceDistance} onChange={e => { setRaceDistance(parseFloat(e.target.value)); }} style={{ width: 100 }} step="0.1" />
                <span style={{ color: "var(--text-secondary)" }}>km</span>
              </div>
            </div>
            <div>
              <label htmlFor="raceTerrain">Terrain</label>
              <select id="raceTerrain" value={raceTerrain} onChange={e => { setRaceTerrain(e.target.value); }} style={{ width: "100%" }}>
                <option value="road">Road</option>
                <option value="trail">Trail</option>
                <option value="track">Track</option>
              </select>
            </div>
            <div>
              <label htmlFor="raceElevation">Elevation Gain (m)</label>
              <input id="raceElevation" type="number" value={raceElevation} onChange={e => { setRaceElevation(e.target.value); }} style={{ width: "100%" }} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="raceGoalTime">Goal Time</label>
              <input id="raceGoalTime" type="text" value={raceGoalTime} onChange={e => { setRaceGoalTime(e.target.value); }} style={{ width: "100%" }} placeholder="h:mm:ss (Optional)" />
            </div>
            <div>
              <label>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["A", "B", "C"].map(p => (
                  <button key={p} className={racePriority === p ? "btn-primary" : "btn-secondary"} onClick={() => { setRacePriority(p); }} style={{ flex: 1 }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
           <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
             <button className="btn-ghost" onClick={() => { resetRaceForm(); }}>Cancel</button>
             <button className="btn-primary" onClick={() => { void handleSaveRace(); }}>{editingRaceId ? "Update Race" : "Save Race"}</button>
          </div>
        </div>
      )}

      {races.length === 0 && !showAddRace ? (
        <div className="empty-state">
          <Trophy size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p>No races planned yet.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Add a race goal to generate a personalized training plan.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {races.map(race => (
            <div key={race.id} className="card" style={{ border: race.is_active ? "2px solid var(--accent)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{race.name}</h3>
                    {race.is_active && <span style={{ background: "var(--accent)", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>ACTIVE</span>}
                    <span style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>{race.priority} Race</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13, display: "flex", gap: 16, marginBottom: 12 }}>
                    <span>{new Date(race.race_date).toLocaleDateString()} ({getWeeksToRace(race.race_date)} weeks)</span>
                    <span>{race.distance_km} km • {race.terrain}</span>
                  </div>
                </div>
                 <div style={{ display: "flex", gap: 8 }}>
                   {!race.is_active && (
                     <button className="btn-secondary" onClick={() => { void handleSetActiveRace(race.id); }}>Set Active</button>
                   )}
                   <button className="btn-ghost" onClick={() => { startEditRace(race); }} title="Edit race">
                    <Pencil size={16} />
                   </button>
                   <button className="btn-ghost" onClick={() => { void handleDeleteRace(race.id); }} style={{ color: "var(--danger)" }}>
                    <Trash2 size={16} />
                   </button>
                </div>
              </div>
               {race.is_active && (
                 <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                   <button className="btn-primary" onClick={() => { void handleGeneratePlan(race.id); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={16} /> Generate Training Plan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGenerating = () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <RefreshCw size={48} className="spin" style={{ color: "var(--accent)", marginBottom: 24 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Generating Your Plan</h2>
      <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 400 }}>
        Analyzing your recent activities and crafting a personalized training schedule to help you crush your goal...
      </p>
    </div>
  );

  const renderCalendar = () => {
    const activeRace = races.find(r => r.is_active);
    
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <button className="btn-ghost" onClick={() => { setView("races"); }} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, padding: 0 }}>
              <ChevronLeft size={16} /> Manage Races
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Training Plan</h1>
            {activeRace && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{activeRace.name} • {getWeeksToRace(activeRace.race_date)} weeks to go</div>}
          </div>
           {activeRace && (
             <button className="btn-secondary" onClick={() => { void handleGeneratePlan(activeRace.id); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={16} /> Regenerate
            </button>
          )}
        </div>

        {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <div style={{ minWidth: 800 }}>
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
              <div style={{ padding: 12, fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Wk</div>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                <div key={day} style={{ padding: 12, fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{day}</div>
              ))}
            </div>
            
             {planWeeks.map((pw) => {
               const isPast = new Date(pw.week.week_start).getTime() < new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
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
                           onClick={() => {
                             setSelectedSession(session);
                             setSessionNotes(session.notes ?? "");
                             setActualDuration(session.actual_duration_min?.toString() ?? "");
                             setActualDistance(session.actual_distance_km?.toString() ?? "");
                          }}
                          style={{ 
                            background: isCompleted ? `${color}20` : isSkipped ? "var(--bg-tertiary)" : `${color}15`,
                            border: `1px solid ${isCompleted ? color : isSkipped ? "var(--border)" : `${color}50`}`,
                            borderRadius: 6, 
                            padding: 8,
                            cursor: "pointer",
                            height: "100%",
                            opacity: isSkipped ? 0.5 : 1,
                            position: "relative"
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
          </div>
        </div>

        {selectedSession && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="card" style={{ width: 400, maxWidth: "90%", maxHeight: "90%", overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: getSessionColor(selectedSession.session_type), textTransform: "capitalize" }}>
                  {selectedSession.session_type.replace("_", " ")}
                </h2>
                <button className="btn-ghost" onClick={() => { setSelectedSession(null); }}><X size={20} /></button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, background: "var(--bg-tertiary)", padding: 12, borderRadius: 6 }}>
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

              {selectedSession.notes && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Coach Notes</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-tertiary)", padding: 12, borderRadius: 6 }}>
                    {selectedSession.notes}
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Log Activity</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label htmlFor="actualDistance">Actual Distance (km)</label>
                    <input id="actualDistance" type="number" value={actualDistance} onChange={e => { setActualDistance(e.target.value); }} style={{ width: "100%" }} step="0.1" />
                  </div>
                  <div>
                    <label htmlFor="actualDuration">Actual Duration (min)</label>
                    <input id="actualDuration" type="number" value={actualDuration} onChange={e => { setActualDuration(e.target.value); }} style={{ width: "100%" }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="sessionNotes">Your Notes</label>
                  <textarea id="sessionNotes" value={sessionNotes} onChange={e => { setSessionNotes(e.target.value); }} style={{ width: "100%", height: 80, resize: "vertical" }} />
                </div>
              </div>

               <div style={{ display: "flex", gap: 8 }}>
                 <button className="btn-secondary" onClick={() => { void handleUpdateSession("skipped"); }} style={{ flex: 1 }}>Mark Skipped</button>
                 <button className="btn-primary" onClick={() => { void handleUpdateSession("completed"); }} style={{ flex: 2, background: "var(--success)" }}>Mark Completed</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      {view === "races" && renderRaceManagement()}
      {view === "generating" && renderGenerating()}
      {view === "calendar" && renderCalendar()}
    </div>
  );
}
