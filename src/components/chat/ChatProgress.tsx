import { useState, useEffect } from "react";
import type { ProgressStep } from "@/components/chat/types";

interface CurrentStepLabelProps {
  label: string;
  startedAt: number;
}

export function CurrentStepLabel({ label, startedAt }: CurrentStepLabelProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => { clearInterval(id); };
  }, [startedAt]);

  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
      <span className="w-2 text-center text-[10px] text-primary">
        {"\u25CF"}
      </span>
      <span>{label} {(elapsed / 1000).toFixed(1)}s</span>
    </div>
  );
}

interface CollapsedStepsSummaryProps {
  steps: ProgressStep[];
}

export function CollapsedStepsSummary({ steps }: CollapsedStepsSummaryProps) {
  const labels = steps.map((s) => s.label).join(" \u00B7 ");

  return (
    <div className="text-[11px] leading-4 text-muted-foreground/60 mb-1">
      {labels}
    </div>
  );
}
