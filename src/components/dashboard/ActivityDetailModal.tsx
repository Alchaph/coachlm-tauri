import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import type { ActivityItem, ActivityLap, ActivityZoneDistribution } from "@/components/dashboard/types";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "@/components/dashboard/types";

interface ActivityDetailModalProps {
  activity: ActivityItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ActivityDetailModal({
  activity,
  open,
  onOpenChange,
}: ActivityDetailModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [laps, setLaps] = useState<ActivityLap[]>([]);
  const [zones, setZones] = useState<ActivityZoneDistribution[]>([]);

  useEffect(() => {
    if (!open || !activity) {
      setLaps([]);
      setZones([]);
      setIsLoading(false);
      return;
    }

    if (!activity.strava_id) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLaps([]);
    setZones([]);

    void Promise.all([
      invoke<ActivityLap[]>("get_activity_laps", { activityId: activity.activity_id }),
      invoke<ActivityZoneDistribution[]>("get_activity_zone_distribution", {
        activityId: activity.activity_id,
      }),
    ])
      .then(([fetchedLaps, fetchedZones]) => {
        if (cancelled) return;
        setLaps(fetchedLaps);
        setZones(fetchedZones);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(
          typeof err === "string"
            ? err
            : "Failed to load activity details",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, activity]);

  const formattedDate = activity?.start_date
    ? new Date(activity.start_date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] max-h-[85vh] w-[95vw] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          {activity ? (
            <>
              <DialogTitle className="text-base font-semibold">
                {activity.name ?? "Untitled Activity"}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {formattedDate && <span>{formattedDate}</span>}
                <span>{formatDistance(activity.distance)}</span>
                <span>{formatDuration(activity.moving_time)}</span>
                <span>{formatPace(activity.distance, activity.moving_time)}</span>
              </div>
            </>
          ) : (
            <DialogTitle className="text-base font-semibold">Activity Details</DialogTitle>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {activity && !activity.strava_id && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground text-center">
              Detailed data available for Strava-synced activities only
            </div>
          )}

          {activity?.strava_id && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Lap Pace</h3>
                {isLoading ? (
                  <Card className="p-4">
                    <Skeleton className="h-[160px] w-full rounded-md" />
                  </Card>
                ) : laps.length === 0 ? (
                  <Card className="p-4 flex items-center justify-center h-[100px]">
                    <span className="text-sm text-muted-foreground">No lap data available</span>
                  </Card>
                ) : (
                  <Card className="p-4 flex items-center justify-center h-[160px]">
                    <span className="text-sm text-muted-foreground">
                      Lap chart will render here
                    </span>
                  </Card>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Heart Rate Zones</h3>
                {isLoading ? (
                  <Card className="p-4">
                    <Skeleton className="h-[160px] w-full rounded-md" />
                  </Card>
                ) : zones.length === 0 ? (
                  <Card className="p-4 flex items-center justify-center h-[100px]">
                    <span className="text-sm text-muted-foreground">
                      No heart rate zone data available
                    </span>
                  </Card>
                ) : (
                  <Card className="p-4 flex items-center justify-center h-[160px]">
                    <span className="text-sm text-muted-foreground">
                      HR zone chart will render here
                    </span>
                  </Card>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
