/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
};

export default nextConfig;
