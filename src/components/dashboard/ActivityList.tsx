import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ActivityItem, AuthStatus } from "@/components/dashboard/types";
import {
  formatPace,
  formatDuration,
  formatDistance,
  formatMaxSpeedPace,
  formatElevation,
} from "@/components/dashboard/types";

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

interface ActivityListProps {
  filteredActivities: ActivityItem[];
  dataLoaded: boolean;
  hasMore: boolean;
  authStatus: AuthStatus;
  activitiesCount: number;
  onLoadMore: () => void;
  onActivityClick?: (activity: ActivityItem) => void;
}

export default function ActivityList({
  filteredActivities,
  dataLoaded,
  hasMore,
  authStatus,
  activitiesCount,
  onLoadMore,
  onActivityClick,
}: ActivityListProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredActivities.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  if (!dataLoaded) {
    return (
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
    );
  }

  if (activitiesCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Activity size={48} className="mb-4 opacity-30" />
        <p>No activities yet.</p>
        <p className="text-xs mt-2">
          {authStatus.connected
            ? 'Click "Sync Activities" to fetch from Strava.'
            : "Connect Strava in Settings to sync your runs."}
        </p>
      </div>
    );
  }

  return (
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
                        <TableRow
                          key={a.activity_id}
                          className={cn("border-b border-border", onActivityClick && "cursor-pointer hover:bg-muted/50")}
                          onClick={() => { onActivityClick?.(a); }}
                        >
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
          <Button variant="secondary" onClick={onLoadMore}>
            Load More
          </Button>
        </div>
      )}
    </>
  );
}
