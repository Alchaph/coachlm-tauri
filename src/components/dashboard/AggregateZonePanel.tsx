import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityZoneSummary } from "@/components/dashboard/types";

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

function formatZoneBoundary(zoneMin: number, zoneMax: number): string {
  if (zoneMin === 0) return `<${String(zoneMax)} bpm`;
  if (zoneMax === -1 || zoneMax >= 999) return `>${String(zoneMin)} bpm`;
  return `${String(zoneMin)}\u2013${String(zoneMax)} bpm`;
}

function formatTotalTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${String(h)}:${m.toString().padStart(2, "0")}`;
  const s = Math.floor(totalSeconds % 60);
  return `${String(m)}:${s.toString().padStart(2, "0")}`;
}

function formatZoneTooltipTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${String(h)}h ${String(m)}m`;
  if (m > 0) return `${String(m)}m ${String(s)}s`;
  return `${String(s)}s`;
}

interface ZoneChartDatum {
  zoneName: string;
  percentage: number;
  totalTimeSeconds: number;
  fill: string;
  zone_min: number;
  zone_max: number;
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
      <p>Time: {formatZoneTooltipTime(datum.totalTimeSeconds)}</p>
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

type RangePreset = 7 | 30 | 90 | null;

interface RangeButton {
  label: string;
  value: RangePreset;
}

const RANGE_BUTTONS: RangeButton[] = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "All Time", value: null },
];

export default function AggregateZonePanel() {
  const [selectedRange, setSelectedRange] = useState<RangePreset>(30);
  const [zones, setZones] = useState<ActivityZoneSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

   const fetchZones = useCallback(async (days: RangePreset) => {
    setIsLoading(true);
    try {
      const result = await invoke<ActivityZoneSummary[]>(
        "get_aggregated_zone_distribution",
        { days }
      );
      setZones(result);
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Failed to load zone data");
      setZones([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchZones(selectedRange);
  }, [fetchZones, selectedRange]);

  const handleRangeChange = (range: RangePreset) => {
    setSelectedRange(range);
  };

  const chartData: ZoneChartDatum[] = [...zones]
    .sort((a, b) => a.zone_index - b.zone_index)
    .map((z) => ({
      zoneName: `Z${String(z.zone_index + 1)}`,
      percentage: z.percentage,
      totalTimeSeconds: z.total_time_seconds,
      fill: getZoneColor(z.zone_index),
      zone_min: z.zone_min,
      zone_max: z.zone_max,
    }));

  const totalSeconds = zones.reduce((sum, z) => sum + z.total_time_seconds, 0);

  return (
    <div data-testid="aggregate-zone-panel" className="mb-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">HR Zone Distribution</CardTitle>
            <div className="flex items-center gap-1">
              {RANGE_BUTTONS.map((btn) => (
                <Button
                  key={String(btn.value)}
                  variant={selectedRange === btn.value ? "default" : "outline"}
                  size="xs"
                  onClick={() => { handleRangeChange(btn.value); }}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="w-full h-[180px]" />
          ) : zones.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
              No heart rate zone data for this period
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
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
                  <Bar dataKey="percentage" maxBarSize={28} shape={<ZoneBarShape />} />
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

              {totalSeconds > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Total training time: {formatTotalTime(totalSeconds)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
