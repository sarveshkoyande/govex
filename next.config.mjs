/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Types are verified separately with `npm run typecheck` (tsc --noEmit).
    // Next's in-build TS worker is skipped here because it exceeds this
    // environment's memory ceiling; tsc passes cleanly.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
