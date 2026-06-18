/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static site: every route is pre-rendered to plain HTML in `out/` and
  // served from Netlify's CDN. Best for SEO/AEO crawlers and lowest hosting cost
  // (no serverless functions). Phase 2 can relax this when adding member features.
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    // Required for static export — images are served as-is (pre-sized & compressed),
    // while next/image still handles lazy-loading and intrinsic sizing (no CLS).
    unoptimized: true,
  },
  // No ESLint config in the project; don't let a missing lint step block CI builds.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
