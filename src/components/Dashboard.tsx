import { useState, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RefreshCw, Activity, Mountain, Timer, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

function getWorkoutBadge(
  workoutType: number | null,
  sportType: string | null,
  activityType: string | null,
): React.ReactNode {
  if (workoutType === 1 || workoutType === 11) {
    return <Badge variant="destructive">Race</Badge>;
  }
  if (workoutType === 2 || workoutType === 12) {
    return <Badge variant="default">Long Run</Badge>;
  }
  if (workoutType === 3 || workoutType === 13) {
    return <Badge variant="secondary">{sportType ?? activityType ?? "Workout"}</Badge>;
  }
  return (
    <span className="text-xs text-muted-foreground">
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

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredActivities.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

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

      {!dataLoaded && (
        <div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} className="text-center">
                <CardContent className="flex flex-col items-center pt-4">
                  <Skeleton className="w-4 h-4 rounded-full mb-2" />
                  <Skeleton className="w-[60px] h-7 mb-1.5" />
                  <Skeleton className="w-20 h-3.5" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="p-0 overflow-hidden">
            <table className="w-full border-collapse">
              <TableHeader>
                <TableRow>
                  {["Date", "Type", "Name", "Distance", "Duration", "Pace", "Elevation", "Max Speed", "Avg HR"].map((h) => (
                    <TableHead key={h} className="px-3.5 py-2.5 text-left">
                      <Skeleton className="w-[60px] h-3" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i} className="border-b border-border">
                    {Array.from({ length: 9 }, (_, j) => (
                      <TableCell key={j} className="px-3.5 py-2.5">
                        <Skeleton className={cn("h-3.5", j === 2 ? "w-[120px]" : "w-[60px]")} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </Card>
        </div>
      )}

      {dataLoaded && stats && stats.total_activities > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-5">
          <Card className="text-center">
            <CardContent className="flex flex-col items-center pt-4">
              <Activity size={16} className="text-primary mb-1" />
              <div className="text-2xl font-bold">{stats.total_activities}</div>
              <div className="text-xs text-muted-foreground">Activities</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="flex flex-col items-center pt-4">
              <TrendingUp size={16} className="text-primary mb-1" />
              <div className="text-2xl font-bold">{stats.total_distance_km.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Total km</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="flex flex-col items-center pt-4">
              <Mountain size={16} className="text-primary mb-1" />
              <div className="text-2xl font-bold">{formatElevation(totalElevation)}</div>
              <div className="text-xs text-muted-foreground">Total Elevation</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="flex flex-col items-center pt-4">
              <Timer size={16} className="text-primary mb-1" />
              <div className="text-2xl font-bold">{formatDuration(totalTime)}</div>
              <div className="text-xs text-muted-foreground">Total Time</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="flex flex-col items-center pt-4">
              <TrendingUp size={16} className="text-primary mb-1" />
              <div className="text-2xl font-bold">{avgPace}</div>
              <div className="text-xs text-muted-foreground">Avg Pace</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="flex flex-col items-center pt-4">
              <BarChart3 size={16} className="text-primary mb-1" />
              <div className="text-2xl font-bold">{thisWeekKm}</div>
              <div className="text-xs text-muted-foreground">This Week km</div>
            </CardContent>
          </Card>
        </div>
      )}

      {dataLoaded && filteredActivities.length === 0 && activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Activity size={48} className="mb-4 opacity-30" />
          <p>No activities yet.</p>
          <p className="text-xs mt-2">
            {authStatus.connected
              ? 'Click "Sync Activities" to fetch from Strava.'
              : "Connect Strava in Settings to sync your runs."}
          </p>
        </div>
      ) : (
        <>
          <Card className="p-0 overflow-hidden mb-5">
            <table className="w-full border-collapse">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-left">Date</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-left">Type</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-left">Name</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-right">Distance</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-right">Duration</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-right">Pace</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-right">Elevation</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-right">Max Speed</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground text-right">Avg HR</TableHead>
                </TableRow>
              </TableHeader>
            </table>
            <div
              ref={tableContainerRef}
              style={{ height: Math.min(filteredActivities.length * 44, 600) }}
              className="overflow-auto"
            >
              <table className="w-full border-collapse" style={{ height: rowVirtualizer.getTotalSize() }}>
                <TableBody>
                  {(() => {
                    const virtualItems = rowVirtualizer.getVirtualItems();
                    const topHeight = virtualItems.length > 0 ? virtualItems[0].start : 0;
                    const lastEnd = virtualItems.length > 0
                      ? virtualItems[virtualItems.length - 1].end
                      : 0;
                    const bottomHeight = rowVirtualizer.getTotalSize() - lastEnd;
                    return (
                      <>
                        {virtualItems.length > 0 && (
                          <TableRow style={{ height: `${String(topHeight)}px` }} />
                        )}
                        {virtualItems.map((virtualRow) => {
                          const a = filteredActivities[virtualRow.index];
                          return (
                            <TableRow key={a.activity_id} className="border-b border-border">
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-muted-foreground">
                                {a.start_date ? new Date(a.start_date).toLocaleDateString() : "\u2014"}
                              </TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px]">
                                {getWorkoutBadge(a.workout_type, a.sport_type, a.type)}
                              </TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px]">{a.name ?? "Untitled"}</TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-right">{formatDistance(a.distance)}</TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-right">{formatDuration(a.moving_time)}</TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-right">{formatPace(a.distance, a.moving_time)}</TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-right">{formatElevation(a.total_elevation_gain)}</TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-right">{formatMaxSpeedPace(a.max_speed)}</TableCell>
                              <TableCell className="px-3.5 py-2.5 text-[13px] text-right">
                                {a.average_heartrate ? String(Math.round(a.average_heartrate)) : "\u2014"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {virtualItems.length > 0 && (
                          <TableRow style={{ height: `${String(bottomHeight)}px` }} />
                        )}
                      </>
                    );
                  })()}
                </TableBody>
              </table>
            </div>
          </Card>

          {hasMore && (
            <div className="text-center mb-5">
              <Button variant="secondary" onClick={loadMore}>
                Load More
              </Button>
            </div>
          )}

          {weeklyVolume.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Weekly Volume</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {weeklyVolume.map((w) => (
                  <div key={w.label} className="flex items-center gap-2.5">
                    <span className="text-xs text-muted-foreground w-[50px] shrink-0 text-right">
                      {w.label}
                    </span>
                    <div className="flex-1 bg-secondary rounded-sm h-5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-sm transition-[width] duration-300 ease-in-out"
                        style={{
                          width: `${Math.max((w.km / maxWeekKm) * 100, 1).toString()}%`,
                          minWidth: w.km === 0 ? 2 : undefined,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-[55px] shrink-0 text-right">
                      {w.km === 0 ? "0 km" : `${String(w.km)} km`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
