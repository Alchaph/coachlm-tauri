import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyVolumeEntry } from "@/components/dashboard/types";

interface ActivityChartProps {
  weeklyVolume: WeeklyVolumeEntry[];
  maxWeekKm: number;
}

export default function ActivityChart({ weeklyVolume, maxWeekKm }: ActivityChartProps) {
  if (weeklyVolume.length === 0) {
    return null;
  }

  return (
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
  );
}
