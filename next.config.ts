import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Cloudinary is wired in Stage 9; allowlist its delivery host ahead of time.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // Mongoose (Stage 6) uses dynamic requires; keep it external to the server
  // bundle so Next doesn't try to trace/bundle it and emit "Critical dependency"
  // warnings. It runs only in the Node.js runtime via the data-access layer.
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
