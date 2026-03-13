// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'magic-sdk': false,
      '@walletconnect/ethereum-provider': false,
    };
    return config;
  },
};

export default nextConfig;
