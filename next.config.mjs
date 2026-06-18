/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Real photography is served locally from /public; next/image optimises it.
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
