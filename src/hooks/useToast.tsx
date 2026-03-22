import { useState, useCallback } from "react";
import { Check, X } from "lucide-react";

interface Toast {
  message: string;
  type: "success" | "error";
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 3000);
  }, []);

  const toastElement = toast ? (
    <div className={`toast toast-${toast.type}`}>
      {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
      {toast.message}
    </div>
  ) : null;

  return { toast, showToast, toastElement };
}
