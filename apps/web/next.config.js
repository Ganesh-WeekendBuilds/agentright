/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@agentright/core'],
};

module.exports = nextConfig;
