import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   *
   *
   *
   */
  redirects() {
    return Promise.resolve([{ source: "/case", destination: "/#decks", permanent: false }]);
  },
};

export default nextConfig;
