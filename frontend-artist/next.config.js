/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone only for Docker, not for Vercel
  output: process.env.VERCEL ? undefined : 'standalone',
  // Optimize build performance
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Disable sourcemaps in production to speed up build
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        pathname: '/image/**',
      },
    ],
  },
};

module.exports = nextConfig;
