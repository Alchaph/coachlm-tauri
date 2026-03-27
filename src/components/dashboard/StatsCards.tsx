import { Activity, Mountain, Timer, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Stats } from "@/components/dashboard/types";

interface StatsCardsProps {
  stats: Stats | null;
  dataLoaded: boolean;
  totalElevation: number;
  totalTime: number;
  avgPace: string;
  thisWeekKm: string;
  formatDuration: (seconds: number | null) => string;
  formatElevation: (meters: number | null) => string;
}

export default function StatsCards({
  stats,
  dataLoaded,
  totalElevation,
  totalTime,
  avgPace,
  thisWeekKm,
  formatDuration,
  formatElevation,
}: StatsCardsProps) {
  if (!dataLoaded) {
    return (
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
    );
  }

  if (!stats || stats.total_activities === 0) {
    return null;
  }

  return (
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
  );
}
