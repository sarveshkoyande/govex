"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { syncTrackerDrive } from "@/app/actions/driveSync";
import { RefreshCw, Loader2 } from "lucide-react";

export default function SyncDriveButton({ trackerId }: { trackerId: string }) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await syncTrackerDrive(trackerId);
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.status === "TRIGGERED") toast.success("Drive sync triggered — new files will appear here shortly.");
      else if (res.data.status === "NOT_CONFIGURED") toast("Drive sync isn't configured yet — set it up under Settings → Drive Sync Webhook.");
      else toast.error(`Sync failed: ${res.data.error}`);
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      {pending ? "Syncing…" : "Sync OneDrive"}
    </button>
  );
}
