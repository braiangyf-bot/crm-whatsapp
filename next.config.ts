import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/whatsapp/responder/media": [
      "./node_modules/ffmpeg-static/**/*",
    ],
  },
};

export default nextConfig;
