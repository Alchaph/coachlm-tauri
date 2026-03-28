import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityZoneDistribution } from "@/components/dashboard/types";

interface ZoneChartDatum {
  zoneName: string;
  timeMinutes: number;
  percentage: number;
  fill: string;
  zone_min: number;
  zone_max: number;
}

interface ActivityZoneChartProps {
  zones: ActivityZoneDistribution[];
}

const ZONE_COLORS = [
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
] as const;

function getZoneColor(index: number): string {
  const clamped = Math.min(index, ZONE_COLORS.length - 1);
  return ZONE_COLORS[clamped];
}

function formatZoneTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins)}:${secs.toString().padStart(2, "0")}`;
}

function formatZoneBoundary(zoneMin: number, zoneMax: number): string {
  if (zoneMin === 0) return `<${String(zoneMax)} bpm`;
  if (zoneMax === -1 || zoneMax >= 999) return `>${String(zoneMin)} bpm`;
  return `${String(zoneMin)}–${String(zoneMax)} bpm`;
}

interface TooltipEntry {
  payload?: ZoneChartDatum;
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
      <p className="font-semibold mb-1">{datum.zoneName}</p>
      <p>Time: {formatZoneTime(datum.timeMinutes * 60)}</p>
      <p>Share: {datum.percentage.toFixed(1)}%</p>
    </div>
  );
}

interface BarShapeArgs {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ZoneChartDatum;
}

function ZoneBarShape({ x = 0, y = 0, width = 0, height = 0, payload }: BarShapeArgs) {
  const fill = payload?.fill ?? "var(--chart-1)";
  const rx = Math.min(3, height / 2);
  return (
    <rect
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      rx={rx}
      ry={rx}
      fill={fill}
    />
  );
}

export default function ActivityZoneChart({ zones }: ActivityZoneChartProps) {
  if (zones.length === 0) return null;

  const totalSeconds = zones.reduce((sum, z) => sum + z.time_seconds, 0);

  const chartData: ZoneChartDatum[] = [...zones]
    .sort((a, b) => a.zone_index - b.zone_index)
    .map((z) => ({
      zoneName: `Z${String(z.zone_index + 1)}`,
      timeMinutes: z.time_seconds / 60,
      percentage: totalSeconds > 0 ? (z.time_seconds / totalSeconds) * 100 : 0,
      fill: getZoneColor(z.zone_index),
      zone_min: z.zone_min,
      zone_max: z.zone_max,
    }));

  return (
    <div data-testid="zone-chart">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Heart Rate Zones</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
            >
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => `${v.toFixed(0)}m`}
              />
              <YAxis
                dataKey="zoneName"
                type="category"
                width={30}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="timeMinutes" maxBarSize={28} shape={<ZoneBarShape />} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {chartData.map((entry) => (
              <span
                key={entry.zoneName}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: entry.fill }}
                />
                {entry.zoneName} ({formatZoneBoundary(entry.zone_min, entry.zone_max)})
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
