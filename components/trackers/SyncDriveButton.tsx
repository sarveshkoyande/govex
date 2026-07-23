"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncTrackerDrive } from "@/app/actions/driveSync";
import { RefreshCw, Loader2 } from "lucide-react";

export default function SyncDriveButton({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await syncTrackerDrive(trackerId);
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.status === "TRIGGERED") toast.success("Drive sync triggered — new files will appear here shortly.");
      else if (res.data.status === "NOT_CONFIGURED") toast("Drive sync isn't configured yet — set it up under Settings → Drive Sync Webhook.");
      else toast.error(`Sync failed: ${res.data.error}`);
      // The actual new content lands asynchronously (Power Automate fetches
      // and POSTs to /api/ingest well after this request returns), so this
      // refresh won't show new files immediately — it's here so the page's
      // other server-rendered data (e.g. the drive-sync cursor/status)
      // reflects this trigger right away instead of needing a manual reload.
      router.refresh();
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
