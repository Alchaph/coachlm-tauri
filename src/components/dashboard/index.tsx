import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import StatsCards from "@/components/dashboard/StatsCards";
import ActivityList from "@/components/dashboard/ActivityList";
import ActivityChart from "@/components/dashboard/ActivityChart";
import {
  computeWeeklyVolume,
  formatPace,
  formatDuration,
  formatElevation,
  getISOWeekStart,
} from "@/components/dashboard/types";
import type { ActivityItem, Stats, AuthStatus } from "@/components/dashboard/types";

export default function Dashboard() {
  const PAGE_SIZE = 50;
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ connected: false, expires_at: null });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [hasMore, setHasMore] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    void loadData();
    const state = { cancelled: false };
    const unlisteners: (() => void)[] = [];

    void (async () => {
      const fns = await Promise.all([
        listen("strava:sync:start", () => {
          if (state.cancelled) return;
          setSyncing(true);
        }),
        listen("strava:sync:complete", () => {
          if (state.cancelled) return;
          setSyncing(false);
          void loadData();
        }),
        listen("strava:sync:context-ready", () => {
          if (state.cancelled) return;
          void loadData();
        }),
        listen<{ message: string }>("strava:sync:error", (e) => {
          if (state.cancelled) return;
          setSyncing(false);
          setError(e.payload.message);
        }),
      ]);
      if (state.cancelled) {
        for (const fn of fns) fn();
      } else {
        unlisteners.push(...fns);
      }
    })();

    return () => { state.cancelled = true; for (const u of unlisteners) u(); };
  }, []);

  const loadData = async (offset = 0) => {
    try {
      const [acts, st, auth] = await Promise.all([
        invoke<ActivityItem[]>("get_recent_activities", { limit: PAGE_SIZE, offset }),
        invoke<Stats>("get_activity_stats"),
        invoke<AuthStatus>("get_strava_auth_status"),
      ]);
      if (offset === 0) {
        setActivities(acts);
      } else {
        setActivities((prev) => [...prev, ...acts]);
      }
      setHasMore(acts.length >= PAGE_SIZE);
      setStats(st);
      setAuthStatus(auth);
      if (offset === 0) {
        setDataLoaded(true);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const loadMore = () => {
    void loadData(activities.length);
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
    <div className="p-6 overflow-auto h-full">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2.5">
          {activities.length > 0 && (
            <Select value={typeFilter} onValueChange={(v) => { if (v !== null) setTypeFilter(v); }}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                {activityTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {authStatus.connected && (
            <Button onClick={() => void handleSync()} disabled={syncing} className="flex items-center gap-1.5">
              <RefreshCw size={16} className={cn(syncing && "animate-spin")} />
              Sync Activities
            </Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{error}</div>}

      <StatsCards
        stats={stats}
        dataLoaded={dataLoaded}
        totalElevation={totalElevation}
        totalTime={totalTime}
        avgPace={avgPace}
        thisWeekKm={thisWeekKm}
        formatDuration={formatDuration}
        formatElevation={formatElevation}
      />

      <ActivityList
        filteredActivities={filteredActivities}
        dataLoaded={dataLoaded}
        hasMore={hasMore}
        authStatus={authStatus}
        activitiesCount={activities.length}
        onLoadMore={loadMore}
      />

      {dataLoaded && activities.length > 0 && (
        <ActivityChart weeklyVolume={weeklyVolume} maxWeekKm={maxWeekKm} />
      )}
    </div>
  );
}
