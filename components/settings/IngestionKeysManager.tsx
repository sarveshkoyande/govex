"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createIngestionKey, revokeIngestionKey } from "@/app/actions/ingestionKeys";
import { Copy, Check, KeyRound, Ban } from "lucide-react";

interface KeyRow {
  id: string;
  label: string;
  tokenPreview: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function IngestionKeysManager({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return toast.error("Enter a label first.");
    startTransition(async () => {
      const res = await createIngestionKey(label.trim());
      if (!res.ok) { toast.error(res.error); return; }
      setRevealedToken(res.data.rawToken);
      setLabel("");
      setKeys((prev) => [
        { id: res.data.id, label: label.trim(), tokenPreview: res.data.tokenPreview, revoked: false, createdAt: res.data.createdAt, lastUsedAt: null },
        ...prev,
      ]);
    });
  }

  function handleRevoke(id: string) {
    if (!confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    startTransition(async () => {
      const res = await revokeIngestionKey(id);
      if (!res.ok) { toast.error(res.error); return; }
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    });
  }

  async function copyToken() {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {revealedToken && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Copy this token now — it won&apos;t be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs">{revealedToken}</code>
            <Button type="button" size="sm" variant="outline" onClick={copyToken}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <button type="button" onClick={() => setRevealedToken(null)} className="self-start text-[11px] font-medium text-amber-700 underline">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex items-end gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="key-label">Label</label>
          <Input id="key-label" placeholder="e.g. Power Automate — prod flow" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending}>
          <KeyRound size={14} /> Create key
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Label</th>
              <th className="px-4 py-2 font-semibold">Token</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Last used</th>
              <th className="px-4 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No ingestion keys yet.</td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2 font-medium text-foreground">{k.label}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">govex_ingest_…{k.tokenPreview}</td>
                <td className="px-4 py-2">
                  <span className={k.revoked ? "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" : "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200"}>
                    {k.revoked ? "Revoked" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                <td className="px-4 py-2 text-right">
                  {!k.revoked && (
                    <button type="button" onClick={() => handleRevoke(k.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline">
                      <Ban size={12} /> Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
