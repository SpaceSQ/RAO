import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://rao.space2.world https://*.space2.world https://qianjia.com https://*.qianjia.com http://localhost:3000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
