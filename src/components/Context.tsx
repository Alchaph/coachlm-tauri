import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Eye, Save, Check, X } from "lucide-react";

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

interface Toast {
  message: string;
  type: "success" | "error";
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
  const [toast, setToast] = useState<Toast | null>(null);
  const [tab, setTab] = useState<"profile" | "insights">("profile");
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");

  useEffect(() => { void loadData(); }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 3000);
  };

  const loadData = async () => {
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
      showToast("Failed to load context data", "error");
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const paceSecs = paceMinutes && paceSeconds
        ? parseInt(paceMinutes) * 60 + parseInt(paceSeconds)
        : null;
      await invoke("save_profile_data", {
        data: { ...profile, threshold_pace_secs: paceSecs },
      });
      showToast("Profile saved", "success");
    } catch {
      showToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteInsight = async (id: number) => {
    try {
      await invoke("delete_pinned_insight", { id });
      setInsights((prev) => prev.filter((i) => i.id !== id));
      showToast("Insight unpinned", "success");
    } catch {
      showToast("Failed to delete insight", "error");
    }
  };

  const loadPreview = async () => {
    try {
      const preview = await invoke<string>("get_context_preview");
      setContextPreview(preview);
      setShowPreview(true);
    } catch {
      showToast("Failed to load preview", "error");
    }
  };

  const numberField = (label: string, field: keyof ProfileData, htmlFor: string, min?: number, max?: number) => (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={htmlFor}>{label}</label>
      <input
        id={htmlFor}
        type="number"
        value={profile[field] !== null ? String(profile[field]) : ""}
        onChange={(e) =>
          { setProfile({ ...profile, [field]: e.target.value ? parseInt(e.target.value) : null }); }
        }
        min={min}
        max={max}
        style={{ width: "100%" }}
      />
    </div>
  );

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Context</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={() => void loadPreview()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Eye size={16} /> Preview Prompt
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className={tab === "profile" ? "btn-primary" : "btn-secondary"}
          onClick={() => { setTab("profile"); }}
        >
          Athlete Profile
        </button>
        <button
          className={tab === "insights" ? "btn-primary" : "btn-secondary"}
          onClick={() => { setTab("insights"); }}
        >
          Pinned Insights ({insights.length})
        </button>
      </div>

      {tab === "profile" && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            {numberField("Age", "age", "profile-age", 1, 120)}
            {numberField("Max HR (bpm)", "max_hr", "profile-max-hr", 100, 220)}
            {numberField("Resting HR (bpm)", "resting_hr", "profile-resting-hr", 30, 120)}
            {numberField("Training days / week", "training_days_per_week", "profile-days", 1, 7)}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="profile-pace">Threshold pace (min:sec/km)</label>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                id="profile-pace"
                type="number"
                value={paceMinutes}
                onChange={(e) => { setPaceMinutes(e.target.value); }}
                placeholder="min"
                min={2}
                max={15}
                style={{ width: 70 }}
              />
              <span style={{ color: "var(--text-muted)" }}>:</span>
              <input
                id="profile-pace-sec"
                type="number"
                value={paceSeconds}
                onChange={(e) => { setPaceSeconds(e.target.value); }}
                placeholder="sec"
                min={0}
                max={59}
                style={{ width: 70 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="profile-mileage">Weekly mileage target (km)</label>
            <input
              id="profile-mileage"
              type="number"
              value={profile.weekly_mileage_target ?? ""}
              onChange={(e) =>
                { setProfile({ ...profile, weekly_mileage_target: e.target.value ? parseFloat(e.target.value) : null }); }
              }
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="profile-exp">Experience level</label>
            <select
              id="profile-exp"
              value={profile.experience_level ?? ""}
              onChange={(e) => { setProfile({ ...profile, experience_level: e.target.value || null }); }}
              style={{ width: "100%" }}
            >
              <option value="">—</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="elite">Elite</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="profile-terrain">Preferred terrain</label>
            <select
              id="profile-terrain"
              value={profile.preferred_terrain ?? ""}
              onChange={(e) => { setProfile({ ...profile, preferred_terrain: e.target.value || null }); }}
              style={{ width: "100%" }}
            >
              <option value="">—</option>
              <option value="road">Road</option>
              <option value="trail">Trail</option>
              <option value="track">Track</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="profile-goals">Race goals</label>
            <textarea
              id="profile-goals"
              value={profile.race_goals ?? ""}
              onChange={(e) => { setProfile({ ...profile, race_goals: e.target.value || null }); }}
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="profile-injuries">Injury history</label>
            <textarea
              id="profile-injuries"
              value={profile.injury_history ?? ""}
              onChange={(e) => { setProfile({ ...profile, injury_history: e.target.value || null }); }}
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="profile-notes">Custom notes</label>
            <textarea
              id="profile-notes"
              value={profile.custom_notes ?? ""}
              onChange={(e) => { setProfile({ ...profile, custom_notes: e.target.value || null }); }}
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Add any training context here — weekly schedule, preferred workouts, limitations, or anything else the coach should know."
            />
          </div>

          <button className="btn-primary" onClick={() => void saveProfile()} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Save size={16} />
            Save Profile
          </button>
        </div>
      )}

      {tab === "insights" && (
        <div>
          {insights.length === 0 ? (
            <div className="empty-state">
              <p>No pinned insights yet.</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>
                Pin messages from the chat to save coaching insights here.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.map((insight) => (
                <div key={insight.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13 }}>{insight.content.length > 500 ? insight.content.slice(0, 497) + "..." : insight.content}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                      {new Date(insight.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button className="btn-ghost" onClick={() => void deleteInsight(insight.id)} title="Delete insight">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPreview && contextPreview && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
          onClick={() => { setShowPreview(false); }}
        >
          <div
            className="card"
            onClick={(e) => { e.stopPropagation(); }}
            style={{ maxWidth: 700, maxHeight: "80vh", overflow: "auto", width: "90%", padding: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Context Preview</h2>
              <button className="btn-ghost" onClick={() => { setShowPreview(false); }}>✕</button>
            </div>
            <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {contextPreview}
            </pre>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
