/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // The Edge proxy engine lives in `proxy.ts` (Cloudflare Workers runtime) and is
  // intentionally excluded from the Next.js build graph — it deploys via Wrangler.
};

export default nextConfig;
