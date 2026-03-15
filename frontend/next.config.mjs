// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ✅ Allow loading images from IPFS gateway
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io",
        pathname: "/ipfs/**",
      },
    ],
  },
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

