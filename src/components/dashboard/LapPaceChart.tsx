import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityLap } from "@/components/dashboard/types";

interface LapChartDatum {
  lapIndex: number;
  paceMinPerKm: number;
  distanceKm: number;
  avgHr: number | null;
}

interface LapPaceChartProps {
  laps: ActivityLap[];
}

function paceToMinPerKm(elapsedTime: number, distance: number): number {
  if (distance === 0) return 0;
  return (elapsedTime / distance) * 1000 / 60;
}

function formatPaceLabel(paceMinPerKm: number): string {
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${String(mins)}:${secs.toString().padStart(2, "0")}`;
}

function computeCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);
  return (stddev / mean) * 100;
}

interface TooltipEntry {
  payload?: LapChartDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold mb-1">Lap {String(datum.lapIndex)}</p>
      <p>Pace: {formatPaceLabel(datum.paceMinPerKm)} /km</p>
      <p>Distance: {datum.distanceKm.toFixed(2)} km</p>
      <p>HR: {datum.avgHr !== null ? `${String(datum.avgHr)} bpm` : "—"}</p>
    </div>
  );
}

export default function LapPaceChart({ laps }: LapPaceChartProps) {
  if (laps.length === 0) return null;

  if (laps.length === 1) {
    const [lap] = laps;
    const pace = paceToMinPerKm(lap.elapsed_time, lap.distance);
    return (
      <Card data-testid="lap-chart">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Pace Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            1 lap (entire activity) — Avg pace: {formatPaceLabel(pace)} /km
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData: LapChartDatum[] = laps.map((lap) => ({
    lapIndex: lap.lap_index,
    paceMinPerKm: paceToMinPerKm(lap.elapsed_time, lap.distance),
    distanceKm: lap.distance / 1000,
    avgHr: lap.average_heartrate !== null ? Math.round(lap.average_heartrate) : null,
  }));

  const paceValues = chartData.map((d) => d.paceMinPerKm).filter((p) => p > 0);
  const cv = computeCV(paceValues);

  const minPace = paceValues.length > 0 ? Math.min(...paceValues) : 0;
  const maxPace = paceValues.length > 0 ? Math.max(...paceValues) : 10;
  const padding = (maxPace - minPace) * 0.15 || 0.5;
  const yDomainMin = Math.max(0, minPace - padding);
  const yDomainMax = maxPace + padding;

  return (
    <div data-testid="lap-chart">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Pace Distribution</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pace CV: {cv.toFixed(1)}% — {cv < 5 ? "very consistent" : cv < 10 ? "consistent" : "variable"}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            >
              <XAxis
                dataKey="lapIndex"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                label={{
                  value: "Lap",
                  position: "insideBottom",
                  offset: -2,
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                }}
              />
              <YAxis
                domain={[yDomainMin, yDomainMax]}
                reversed
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => formatPaceLabel(v)}
                width={38}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
              <Bar
                dataKey="paceMinPerKm"
                fill="var(--chart-1)"
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
