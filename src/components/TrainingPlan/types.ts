export interface Race {
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

export interface TrainingPlan {
  id: string;
  race_id: string;
  generated_at: string;
  llm_backend: string;
  prompt_hash: string;
  is_active: boolean;
}

export interface PlanSession {
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

export interface PlanWeekWithSessions {
  week: {
    id: string;
    plan_id: string;
    week_number: number;
    week_start: string;
  };
  sessions: PlanSession[];
}

export interface TrainingPlanSummary {
  id: string;
  race_id: string;
  race_name: string;
  generated_at: string;
  is_active: boolean;
  total_sessions: number;
  completed_sessions: number;
}

export function getSessionColor(type: string): string {
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
}

export function formatPace(low: number | null, high: number | null): string {
  if (!low && !high) return "";
  const format = (p: number) => `${String(Math.floor(p))}:${Math.round((p % 1) * 60).toString().padStart(2, "0")}`;
  if (low && high) return `${format(low)} - ${format(high)}/km`;
  if (low) return `${format(low)}/km`;
  return `${format(high ?? 0)}/km`;
}

export function getWeeksToRace(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
}

export function formatGoalTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h)}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
