import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RefreshCw, Activity } from "lucide-react";

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

export default function Dashboard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ connected: false, expires_at: null });
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const unlisteners: (() => void)[] = [];

    (async () => {
      unlisteners.push(await listen("strava:sync:start", () => {
        setSyncing(true);
        setSyncProgress("Starting sync...");
      }));
      unlisteners.push(await listen<{ current: number; total: number }>("strava:sync:progress", (e) => {
        setSyncProgress(`Syncing: ${e.payload.current} activities`);
      }));
      unlisteners.push(await listen<{ new_count: number; total_count: number }>("strava:sync:complete", (e) => {
        setSyncing(false);
        setSyncProgress(`Done! ${e.payload.new_count} new activities (${e.payload.total_count} total)`);
        loadData();
        setTimeout(() => setSyncProgress(null), 3000);
      }));
      unlisteners.push(await listen<{ message: string }>("strava:sync:error", (e) => {
        setSyncing(false);
        setError(e.payload.message);
      }));
    })();

    return () => { unlisteners.forEach((u) => u()); };
  }, []);

  const loadData = async () => {
    try {
      const [acts, st, auth] = await Promise.all([
        invoke<ActivityItem[]>("get_recent_activities", { limit: 20 }),
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
    if (!distance || !time || distance === 0) return "—";
    const paceSecsPerKm = time / (distance / 1000);
    const mins = Math.floor(paceSecsPerKm / 60);
    const secs = Math.floor(paceSecsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDistance = (meters: number | null): string => {
    if (!meters) return "—";
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
        {authStatus.connected && (
          <button className="btn-primary" onClick={handleSync} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Syncing..." : "Sync Activities"}
          </button>
        )}
      </div>

      {syncProgress && (
        <div style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 6, marginBottom: 16, color: "var(--accent)", fontSize: 13 }}>
          {syncProgress}
        </div>
      )}

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      {stats && stats.total_activities > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_activities}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Activities</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_distance_km.toFixed(0)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total km</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {stats.earliest_date?.slice(0, 10)} → {stats.latest_date?.slice(0, 10)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Date Range</div>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Date</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Name</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Distance</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Duration</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Pace</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Avg HR</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.activity_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text-secondary)" }}>
                    {a.start_date ? new Date(a.start_date).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{a.name ?? "Untitled"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right" }}>{formatDistance(a.distance)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right" }}>{formatDuration(a.moving_time)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right" }}>{formatPace(a.distance, a.moving_time)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right" }}>
                    {a.average_heartrate ? `${Math.round(a.average_heartrate)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
