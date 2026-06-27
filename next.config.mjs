/** @type {import('next').NextConfig} */

// When building for GitHub Pages (set by the deploy workflow) we emit a fully
// static export under the repo's base path. Local `next dev` / `next build`
// are unaffected — GITHUB_PAGES is only set in CI.
const isPagesExport = process.env.GITHUB_PAGES === "true";
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // No next/image usage; keep images unoptimized so static export is clean.
  images: { unoptimized: true },
  ...(isPagesExport
    ? { output: "export", basePath, trailingSlash: true }
    : {}),
  // The Edge proxy engine (`proxy.ts`) is excluded from the Next build graph —
  // it deploys via Wrangler.
};

export default nextConfig;
