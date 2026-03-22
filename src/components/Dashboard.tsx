import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RefreshCw, Activity, Mountain, Timer, TrendingUp, BarChart3 } from "lucide-react";

interface ActivityItem {
  activity_id: string;
  strava_id: string | null;
  name: string | null;
  type: string | null;
  start_date: string | null;
  distance: number | null;
  moving_time: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_cadence: number | null;
  gear_id: string | null;
  elapsed_time: number | null;
  total_elevation_gain: number | null;
  max_speed: number | null;
  workout_type: number | null;
  sport_type: string | null;
  start_date_local: string | null;
}

interface Stats {
  total_activities: number;
  total_distance_km: number;
  earliest_date: string | null;
  latest_date: string | null;
}

interface AuthStatus {
  connected: boolean;
  expires_at: number | null;
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
};

function getWorkoutBadge(
  workoutType: number | null,
  sportType: string | null,
  activityType: string | null,
): React.ReactNode {
  const badgeBase: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 0,
    fontSize: 11,
    fontWeight: 600,
    color: "white",
  };

  if (workoutType === 1 || workoutType === 11) {
    return <span style={{ ...badgeBase, background: "var(--danger)" }}>Race</span>;
  }
  if (workoutType === 2 || workoutType === 12) {
    return <span style={{ ...badgeBase, background: "var(--accent)" }}>Long Run</span>;
  }
  if (workoutType === 3 || workoutType === 13) {
    return <span style={{ ...badgeBase, background: "var(--warning)" }}>Workout</span>;
  }
  return (
    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      {sportType ?? activityType ?? "Run"}
    </span>
  );
}

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()] ?? ""} ${String(date.getDate())}`;
}

function computeWeeklyVolume(activities: ActivityItem[]): { label: string; km: number }[] {
  const now = new Date();
  const currentWeekStart = getISOWeekStart(now);
  const weeks: { label: string; km: number; start: Date }[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    weeks.push({ label: formatWeekLabel(weekStart), km: 0, start: weekStart });
  }

  for (const act of activities) {
    if (!act.start_date || act.distance === null) continue;
    const actDate = new Date(act.start_date);
    const actWeekStart = getISOWeekStart(actDate);

    for (const week of weeks) {
      if (actWeekStart.getTime() === week.start.getTime()) {
        week.km += act.distance / 1000;
        break;
      }
    }
  }

  return weeks.map((w) => ({ label: w.label, km: Math.round(w.km * 10) / 10 }));
}

export default function Dashboard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ connected: false, expires_at: null });
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    void loadData();
    const unlisteners: (() => void)[] = [];

    void (async () => {
      unlisteners.push(await listen("strava:sync:start", () => {
        setSyncing(true);
        setSyncProgress("Starting sync...");
      }));
      unlisteners.push(await listen<{ current: number; total: number }>("strava:sync:progress", (e) => {
        setSyncProgress(`Syncing: ${String(e.payload.current)} activities`);
      }));
       unlisteners.push(await listen<{ new_count: number; total_count: number }>("strava:sync:complete", (e) => {
         setSyncing(false);
         setSyncProgress(`Done! ${String(e.payload.new_count)} new activities (${String(e.payload.total_count)} total)`);
         void loadData();
         setTimeout(() => { setSyncProgress(null); }, 3000);
       }));
       unlisteners.push(await listen<string>("strava:sync:context-ready", () => {
         setSyncProgress("Context updated");
         void loadData();
         setTimeout(() => { setSyncProgress(null); }, 3000);
       }));
       unlisteners.push(await listen<{ message: string }>("strava:sync:error", (e) => {
         setSyncing(false);
         setError(e.payload.message);
       }));
    })();

    return () => { unlisteners.forEach((u) => { u(); }); };
  }, []);

  const loadData = async () => {
    try {
      const [acts, st, auth] = await Promise.all([
        invoke<ActivityItem[]>("get_recent_activities", { limit: 50 }),
        invoke<Stats>("get_activity_stats"),
        invoke<AuthStatus>("get_strava_auth_status"),
      ]);
      setActivities(acts);
      setStats(st);
      setAuthStatus(auth);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setError(null);
    try {
      await invoke("sync_strava_activities");
    } catch (e) {
      setSyncing(false);
      setError(String(e));
    }
  };

  const formatPace = (distance: number | null, time: number | null): string => {
    if (!distance || !time || distance === 0) return "\u2014";
    const paceSecsPerKm = time / (distance / 1000);
    const mins = Math.floor(paceSecsPerKm / 60);
    const secs = Math.floor(paceSecsPerKm % 60);
    return `${String(mins)}:${secs.toString().padStart(2, "0")}/km`;
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "\u2014";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${String(h)}h ${String(m)}m`;
    return `${String(m)}m`;
  };

  const formatDistance = (meters: number | null): string => {
    if (!meters) return "\u2014";
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatMaxSpeedPace = (maxSpeed: number | null): string => {
    if (!maxSpeed || maxSpeed === 0) return "\u2014";
    const secsPerKm = 1000 / maxSpeed;
    const mins = Math.floor(secsPerKm / 60);
    const secs = Math.floor(secsPerKm % 60);
    return `${String(mins)}:${secs.toString().padStart(2, "0")}/km`;
  };

  const formatElevation = (meters: number | null): string => {
    if (meters === null) return "\u2014";
    return `${Math.round(meters).toString()}m`;
  };

  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    for (const a of activities) {
      const t = a.sport_type ?? a.type;
      if (t) types.add(t);
    }
    return Array.from(types).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (typeFilter === "All") return activities;
    return activities.filter((a) => (a.sport_type ?? a.type) === typeFilter);
  }, [activities, typeFilter]);

  const totalElevation = useMemo(() => {
    let sum = 0;
    for (const a of activities) {
      if (a.total_elevation_gain !== null) sum += a.total_elevation_gain;
    }
    return sum;
  }, [activities]);

  const totalTime = useMemo(() => {
    let sum = 0;
    for (const a of activities) {
      if (a.moving_time !== null) sum += a.moving_time;
    }
    return sum;
  }, [activities]);

  const avgPace = useMemo(() => {
    const totalDist = activities.reduce((s, a) => s + (a.distance ?? 0), 0);
    if (totalDist === 0 || totalTime === 0) return "\u2014";
    return formatPace(totalDist, totalTime);
  }, [activities, totalTime]);

  const thisWeekKm = useMemo(() => {
    const weekStart = getISOWeekStart(new Date());
    let sum = 0;
    for (const a of activities) {
      if (!a.start_date || a.distance === null) continue;
      if (new Date(a.start_date) >= weekStart) {
        sum += a.distance;
      }
    }
    return (sum / 1000).toFixed(1);
  }, [activities]);

  const weeklyVolume = useMemo(() => computeWeeklyVolume(activities), [activities]);
  const maxWeekKm = useMemo(() => Math.max(...weeklyVolume.map((w) => w.km), 1), [weeklyVolume]);

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {activities.length > 0 && (
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); }}
               style={{
                 background: "var(--bg-tertiary)",
                 border: "1px solid var(--border)",
                 color: "var(--text-primary)",
                 borderRadius: 0,
                 padding: "4px 8px",
                 fontSize: 13,
               }}
            >
              <option value="All">All Types</option>
              {activityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {authStatus.connected && (
            <button className="btn-primary" onClick={() => void handleSync()} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={16} className={syncing ? "spin" : ""} />
              Sync Activities
            </button>
          )}
        </div>
      </div>

       {syncProgress && (
         <div style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 0, marginBottom: 16, color: "var(--accent)", fontSize: 13 }}>
           {syncProgress}
         </div>
       )}

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      {stats && stats.total_activities > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <Activity size={16} style={{ color: "var(--accent)", marginBottom: 4 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_activities}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Activities</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <TrendingUp size={16} style={{ color: "var(--accent)", marginBottom: 4 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_distance_km.toFixed(0)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total km</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <Mountain size={16} style={{ color: "var(--accent)", marginBottom: 4 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatElevation(totalElevation)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Elevation</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <Timer size={16} style={{ color: "var(--accent)", marginBottom: 4 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatDuration(totalTime)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Time</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <TrendingUp size={16} style={{ color: "var(--accent)", marginBottom: 4 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{avgPace}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Avg Pace</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <BarChart3 size={16} style={{ color: "var(--accent)", marginBottom: 4 }} />
            <div style={{ fontSize: 24, fontWeight: 700 }}>{thisWeekKm}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>This Week km</div>
          </div>
        </div>
      )}

      {filteredActivities.length === 0 && activities.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p>No activities yet.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {authStatus.connected
              ? 'Click "Sync Activities" to fetch from Strava.'
              : "Connect Strava in Settings to sync your runs."}
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ ...thStyle, textAlign: "left" }}>Date</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Type</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Name</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Distance</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Duration</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Pace</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Elevation</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Max Speed</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Avg HR</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((a) => (
                  <tr key={a.activity_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>
                      {a.start_date ? new Date(a.start_date).toLocaleDateString() : "\u2014"}
                    </td>
                    <td style={tdStyle}>
                      {getWorkoutBadge(a.workout_type, a.sport_type, a.type)}
                    </td>
                    <td style={tdStyle}>{a.name ?? "Untitled"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatDistance(a.distance)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatDuration(a.moving_time)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatPace(a.distance, a.moving_time)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatElevation(a.total_elevation_gain)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMaxSpeedPace(a.max_speed)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {a.average_heartrate ? String(Math.round(a.average_heartrate)) : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {weeklyVolume.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Weekly Volume</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {weeklyVolume.map((w) => (
                  <div key={w.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", width: 50, flexShrink: 0, textAlign: "right" }}>
                      {w.label}
                    </span>
                     <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: 0, height: 20, overflow: "hidden" }}>
                       <div
                         style={{
                           width: `${Math.max((w.km / maxWeekKm) * 100, 1).toString()}%`,
                           height: "100%",
                           background: "var(--accent)",
                           borderRadius: 0,
                           minWidth: w.km === 0 ? 2 : undefined,
                           transition: "width 0.3s ease",
                         }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 55, flexShrink: 0, textAlign: "right" }}>
                      {w.km === 0 ? "0 km" : `${String(w.km)} km`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
