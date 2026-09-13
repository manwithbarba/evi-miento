import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = isGitHubPages
  ? {
      output: 'export',
      trailingSlash: true,
      basePath: '/evi-miento',
      assetPrefix: '/evi-miento/',
    }
  : {};

export default nextConfig;
