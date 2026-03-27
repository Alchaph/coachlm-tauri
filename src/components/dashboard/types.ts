export interface ActivityItem {
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

export interface Stats {
  total_activities: number;
  total_distance_km: number;
  earliest_date: string | null;
  latest_date: string | null;
}

export interface AuthStatus {
  connected: boolean;
  expires_at: number | null;
}

export interface WeeklyVolumeEntry {
  label: string;
  km: number;
}

export function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekLabel(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()] ?? ""} ${String(date.getDate())}`;
}

export function computeWeeklyVolume(activities: ActivityItem[]): WeeklyVolumeEntry[] {
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

export function formatPace(distance: number | null, time: number | null): string {
  if (!distance || !time || distance === 0) return "\u2014";
  const paceSecsPerKm = time / (distance / 1000);
  const mins = Math.floor(paceSecsPerKm / 60);
  const secs = Math.floor(paceSecsPerKm % 60);
  return `${String(mins)}:${secs.toString().padStart(2, "0")}/km`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "\u2014";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${String(h)}h ${String(m)}m`;
  return `${String(m)}m`;
}

export function formatDistance(meters: number | null): string {
  if (!meters) return "\u2014";
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatMaxSpeedPace(maxSpeed: number | null): string {
  if (!maxSpeed || maxSpeed === 0) return "\u2014";
  const secsPerKm = 1000 / maxSpeed;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.floor(secsPerKm % 60);
  return `${String(mins)}:${secs.toString().padStart(2, "0")}/km`;
}

export function formatElevation(meters: number | null): string {
  if (meters === null) return "\u2014";
  return `${Math.round(meters).toString()}m`;
}

export interface ActivityLap {
  id: number | null;
  activity_id: string;
  lap_index: number;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  average_speed: number;
  max_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_cadence: number | null;
  total_elevation_gain: number | null;
}

export interface ActivityZoneDistribution {
  activity_id: string;
  zone_index: number;
  zone_min: number;
  zone_max: number;
  time_seconds: number;
}

export interface ActivityZoneSummary {
  zone_index: number;
  zone_min: number;
  zone_max: number;
  total_time_seconds: number;
  percentage: number;
}

export interface ActivityDetailData {
  laps: ActivityLap[];
  zones: ActivityZoneDistribution[];
}
