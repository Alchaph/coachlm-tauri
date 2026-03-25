import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { Trash2, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ProfileData {
  age: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  threshold_pace_secs: number | null;
  weekly_mileage_target: number | null;
  race_goals: string | null;
  injury_history: string | null;
  experience_level: string | null;
  training_days_per_week: number | null;
  preferred_terrain: string | null;
  heart_rate_zones: string | null;
  custom_notes: string | null;
}

interface Insight {
  id: number;
  content: string;
  source_session_id: string | null;
  created_at: string;
}

export default function Context() {
  const [profile, setProfile] = useState<ProfileData>({
    age: null, max_hr: null, resting_hr: null, threshold_pace_secs: null,
    weekly_mileage_target: null, race_goals: null, injury_history: null,
    experience_level: null, training_days_per_week: null, preferred_terrain: null,
    heart_rate_zones: null,
    custom_notes: null,
  });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "insights">("profile");
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [p, ins] = await Promise.all([
        invoke<ProfileData | null>("get_profile_data"),
        invoke<Insight[]>("get_pinned_insights"),
      ]);
      if (p) {
        setProfile(p);
        if (p.threshold_pace_secs) {
          setPaceMinutes(Math.floor(p.threshold_pace_secs / 60).toString());
          setPaceSeconds((p.threshold_pace_secs % 60).toString().padStart(2, "0"));
        }
      }
      setInsights(ins);
    } catch {
      toast.error("Failed to load context data");
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const paceSecs = paceMinutes && paceSeconds
        ? parseInt(paceMinutes) * 60 + parseInt(paceSeconds)
        : null;
      await invoke("save_profile_data", {
        data: { ...profile, threshold_pace_secs: paceSecs },
      });
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const deleteInsight = async (id: number) => {
    const confirmed = await ask("Unpin this insight?", { title: "CoachLM", kind: "warning" });
    if (!confirmed) return;
    try {
      await invoke("delete_pinned_insight", { id });
      setInsights((prev) => prev.filter((i) => i.id !== id));
      toast.success("Insight unpinned");
    } catch {
      toast.error("Failed to delete insight");
    }
  };

  const loadPreview = async () => {
    try {
      const preview = await invoke<string>("get_context_preview");
      setContextPreview(preview);
      setShowPreview(true);
    } catch {
      toast.error("Failed to load preview");
    }
  };

  const numberField = (label: string, field: keyof ProfileData, htmlFor: string, min?: number, max?: number) => (
    <div className="mb-3">
      <Label htmlFor={htmlFor} className="mb-1.5">{label}</Label>
      <Input
        id={htmlFor}
        type="number"
        value={profile[field] !== null ? String(profile[field]) : ""}
        onChange={(e) =>
          { setProfile({ ...profile, [field]: e.target.value ? parseInt(e.target.value) : null }); }
        }
        min={min}
        max={max}
      />
    </div>
  );

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold">Context</h1>
        <Button variant="secondary" size="sm" onClick={() => void loadPreview()}>
          <Eye className="size-4" /> Preview Prompt
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => { setTab(v as "profile" | "insights"); }}
        className="gap-0"
      >
        <TabsList className="mb-5">
          <TabsTrigger value="profile">Athlete Profile</TabsTrigger>
          <TabsTrigger value="insights">Pinned Insights ({insights.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="max-w-[600px]">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-x-4">
                {numberField("Age", "age", "profile-age", 1, 120)}
                {numberField("Max HR (bpm)", "max_hr", "profile-max-hr", 100, 220)}
                {numberField("Resting HR (bpm)", "resting_hr", "profile-resting-hr", 30, 120)}
                {numberField("Training days / week", "training_days_per_week", "profile-days", 1, 7)}
              </div>

              <div className="mb-3">
                <Label htmlFor="profile-pace" className="mb-1.5">Threshold pace (min:sec/km)</Label>
                <div className="flex gap-1.5 items-center">
                  <Input
                    id="profile-pace"
                    type="number"
                    value={paceMinutes}
                    onChange={(e) => { setPaceMinutes(e.target.value); }}
                    placeholder="min"
                    min={2}
                    max={15}
                    className="w-[70px]"
                  />
                  <span className="text-muted-foreground">:</span>
                  <Input
                    id="profile-pace-sec"
                    type="number"
                    value={paceSeconds}
                    onChange={(e) => { setPaceSeconds(e.target.value); }}
                    placeholder="sec"
                    min={0}
                    max={59}
                    className="w-[70px]"
                  />
                </div>
              </div>

              <div className="mb-3">
                <Label htmlFor="profile-mileage" className="mb-1.5">Weekly mileage target (km)</Label>
                <Input
                  id="profile-mileage"
                  type="number"
                  value={profile.weekly_mileage_target ?? ""}
                  onChange={(e) =>
                    { setProfile({ ...profile, weekly_mileage_target: e.target.value ? parseFloat(e.target.value) : null }); }
                  }
                />
              </div>

              <div className="mb-3">
                <Label className="mb-1.5">Experience level</Label>
                <Select value={profile.experience_level ?? ""} onValueChange={(v) => { setProfile({ ...profile, experience_level: v ?? null }); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mb-3">
                <Label className="mb-1.5">Preferred terrain</Label>
                <Select value={profile.preferred_terrain ?? ""} onValueChange={(v) => { setProfile({ ...profile, preferred_terrain: v ?? null }); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="trail">Trail</SelectItem>
                    <SelectItem value="track">Track</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mb-3">
                <Label htmlFor="profile-goals" className="mb-1.5">Race goals</Label>
                <Textarea
                  id="profile-goals"
                  value={profile.race_goals ?? ""}
                  onChange={(e) => { setProfile({ ...profile, race_goals: e.target.value || null }); }}
                  rows={2}
                  className="resize-y"
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="profile-injuries" className="mb-1.5">Injury history</Label>
                <Textarea
                  id="profile-injuries"
                  value={profile.injury_history ?? ""}
                  onChange={(e) => { setProfile({ ...profile, injury_history: e.target.value || null }); }}
                  rows={2}
                  className="resize-y"
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="profile-notes" className="mb-1.5">Custom notes</Label>
                <Textarea
                  id="profile-notes"
                  value={profile.custom_notes ?? ""}
                  onChange={(e) => { setProfile({ ...profile, custom_notes: e.target.value || null }); }}
                  rows={4}
                  className="resize-y"
                  placeholder="Add any training context here — weekly schedule, preferred workouts, limitations, or anything else the coach should know."
                />
              </div>

              <Button onClick={() => void saveProfile()} disabled={saving}>
                <Save className="size-4" />
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p>No pinned insights yet.</p>
              <p className="text-xs mt-2">
                Pin messages from the chat to save coaching insights here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {insights.map((insight) => (
                <Card key={insight.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm">{insight.content.length > 500 ? insight.content.slice(0, 497) + "..." : insight.content}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(insight.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger>
                          <Button variant="ghost" size="icon-sm" onClick={() => void deleteInsight(insight.id)} aria-label="Delete insight">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete insight</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[700px] max-h-[80vh] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Context Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-muted-foreground">
              {contextPreview}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
