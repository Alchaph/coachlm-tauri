import { toast } from "sonner";

export function useToast() {
  return {
    showToast: (message: string, type: "success" | "error") => {
      if (type === "success") {
        toast.success(message);
      } else {
        toast.error(message);
      }
    },
  };
}
