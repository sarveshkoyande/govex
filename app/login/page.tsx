import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — GovEx Command Center" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Animated colour blobs — same treatment as the dashboard shell */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="animate-blob absolute -top-40 -left-32 w-[600px] h-[600px] rounded-full bg-[oklch(0.58_0.18_245)] opacity-[0.10] blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-[oklch(0.46_0.20_258)] opacity-[0.08] blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute -bottom-20 left-1/3 w-[550px] h-[550px] rounded-full bg-[oklch(0.68_0.13_232)] opacity-[0.06] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, oklch(0.46 0.19 258), oklch(0.30 0.18 268))" }}
          >
            <svg width="20" height="20" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.9" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">GovEx Command Center</h1>
            <p className="text-xs text-muted-foreground">Strategic OKR Intelligence Platform</p>
          </div>
        </div>

        <LoginForm callbackUrl={sp.callbackUrl} initialError={sp.error} />
      </div>
    </div>
  );
}
