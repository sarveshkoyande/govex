"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDriveSyncConfig, sendDriveSyncTestPing } from "@/app/actions/driveSyncConfig";
import { Save, Send, CheckCircle2, XCircle } from "lucide-react";

interface Initial {
  url: string;
  secret: string;
  active: boolean;
  hasSecret: boolean;
  lastStatus: string | null;
  lastError: string | null;
  lastUsedAt: string | null;
}

export default function DriveSyncWebhookForm({ initial }: { initial: Initial }) {
  const [url, setUrl] = useState(initial.url);
  const [secret, setSecret] = useState("");
  const [active, setActive] = useState(initial.active);
  const [lastStatus, setLastStatus] = useState(initial.lastStatus);
  const [lastError, setLastError] = useState(initial.lastError);
  const [saving, startSaving] = useTransition();
  const [pinging, startPinging] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const res = await saveDriveSyncConfig({ url, secret, active });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Saved.");
    });
  }

  function ping() {
    startPinging(async () => {
      const res = await sendDriveSyncTestPing();
      if (!res.ok) { toast.error(res.error); return; }
      setLastStatus(res.data.status);
      setLastError(res.data.error ?? null);
      if (res.data.delivered) toast.success("Test ping delivered.");
      else if (res.data.status === "NOT_CONFIGURED") toast("Not configured — save a URL and activate first.");
      else toast.error(`Ping failed: ${res.data.error}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={save} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="url">Webhook URL</Label>
          <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://prod-00.westus.logic.azure.com/... (or /api/dev/echo to test)" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="secret">Shared secret {initial.hasSecret && <span className="font-normal text-muted-foreground">(currently set — leave blank to keep)</span>}</Label>
          <Input id="secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="optional — sent as Authorization: Bearer <secret>" />
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={saving}><Save size={14} /> Save</Button>
          <Button type="button" variant="outline" onClick={ping} disabled={pinging}><Send size={14} /> Send test ping</Button>
        </div>
      </form>

      {lastStatus && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          {lastStatus === "SUCCESS" ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-destructive" />}
          <span className="font-semibold">Last result: {lastStatus}</span>
          {lastError && <span className="text-muted-foreground">— {lastError}</span>}
        </div>
      )}
    </div>
  );
}
