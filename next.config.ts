import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
  /* config options here */
};

export default nextConfig;

