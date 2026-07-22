"use client";

import { Bell, CalendarDays, LogOut, ChevronDown, KeyRound, Send, BarChart3, BookOpen, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface AppHeaderProps {
  userName: string;
  userEmail: string;
  role: string;
}

export default function AppHeader({ userName, userEmail, role }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function openMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setMenuOpen((v) => !v);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      // Portal content (menuRef) is NOT a DOM descendant of btnRef, so it must
      // be excluded here too — otherwise mousedown on a menu item (Sign out,
      // Ingestion Keys) closes+unmounts the portal before its own click
      // handler/navigation fires, silently swallowing the click.
      const insideButton = btnRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideButton && !insideMenu) setMenuOpen(false);
    }
    const id = setTimeout(() => document.addEventListener("mousedown", handle), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handle);
    };
  }, [menuOpen]);

  const initials = (userName || userEmail || "GX")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const dropdown =
    menuOpen &&
    mounted &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed", top: menuPos.top, right: menuPos.right, width: 240, zIndex: 9999,
          background: "oklch(0.22 0.14 268)", border: "1px solid oklch(1 0 0 / 0.12)",
          borderRadius: "0.75rem", boxShadow: "0 20px 60px oklch(0 0 0 / 0.55)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid oklch(1 0 0 / 0.10)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "white", margin: 0 }}>{userName || "GovEx User"}</p>
          <p style={{ fontSize: 10, color: "oklch(1 0 0 / 0.55)", margin: "2px 0 0" }}>{userEmail}</p>
          <p style={{ fontSize: 10, color: "oklch(0.80 0.12 220)", margin: "4px 0 0", fontWeight: 600 }}>{role}</p>
        </div>
        {role === "SYSTEM_ADMIN" && (
          <Link
            href="/settings/ingestion-keys"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              color: "oklch(1 0 0 / 0.85)", fontSize: 12, borderBottom: "1px solid oklch(1 0 0 / 0.10)",
            }}
          >
            <KeyRound size={13} />
            Ingestion Keys
          </Link>
        )}
        {role === "SYSTEM_ADMIN" && (
          <Link
            href="/settings/outbound-webhook"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              color: "oklch(1 0 0 / 0.85)", fontSize: 12, borderBottom: "1px solid oklch(1 0 0 / 0.10)",
            }}
          >
            <Send size={13} />
            Outbound Webhook
          </Link>
        )}
        {role === "SYSTEM_ADMIN" && (
          <Link
            href="/settings/drive-sync-webhook"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              color: "oklch(1 0 0 / 0.85)", fontSize: 12, borderBottom: "1px solid oklch(1 0 0 / 0.10)",
            }}
          >
            <RefreshCw size={13} />
            Drive Sync Webhook
          </Link>
        )}
        {role === "SYSTEM_ADMIN" && (
          <Link
            href="/settings/question-patterns"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              color: "oklch(1 0 0 / 0.85)", fontSize: 12, borderBottom: "1px solid oklch(1 0 0 / 0.10)",
            }}
          >
            <BarChart3 size={13} />
            Question Patterns
          </Link>
        )}
        {role === "SYSTEM_ADMIN" && (
          <Link
            href="/settings/skills"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              color: "oklch(1 0 0 / 0.85)", fontSize: 12, borderBottom: "1px solid oklch(1 0 0 / 0.10)",
            }}
          >
            <BookOpen size={13} />
            Skills Library
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          role="menuitem"
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
            background: "none", border: "none", cursor: "pointer", color: "oklch(1 0 0 / 0.85)", fontSize: 12,
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>,
      document.body,
    );

  return (
    <header
      className="flex h-14 flex-shrink-0 items-center justify-between px-6"
      style={{ background: "linear-gradient(90deg, oklch(0.46 0.19 258) 0%, oklch(0.30 0.18 268) 100%)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: "oklch(1 0 0 / 0.18)", border: "1px solid oklch(1 0 0 / 0.25)" }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9" />
            <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9" />
            <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.9" />
            <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-tight text-white">GovEx Command Center</p>
          <p className="text-[10px] leading-tight text-white/65">Strategic OKR Intelligence Platform</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex cursor-not-allowed select-none items-center gap-2 rounded-md px-3 py-1.5 text-xs text-white/50"
          style={{ background: "oklch(1 0 0 / 0.08)", border: "1px solid oklch(1 0 0 / 0.15)" }}
          aria-disabled="true"
          title="Date range selection coming soon"
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Last 12 Months</span>
        </div>

        <button className="relative rounded-md p-1.5 text-white/70 transition-colors hover:text-white" aria-label="View notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" />
        </button>

        <button
          ref={btnRef}
          onClick={openMenu}
          className="flex items-center gap-1 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-80"
          aria-label="Open profile menu"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "oklch(1 0 0 / 0.20)", border: "1px solid oklch(1 0 0 / 0.30)" }}
          >
            {initials || "GX"}
          </span>
          <ChevronDown size={13} className="text-white/70" />
        </button>
      </div>

      {dropdown}
    </header>
  );
}
