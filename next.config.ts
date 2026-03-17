import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Cloud Run 등 컨테이너 배포용 최소 빌드
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
