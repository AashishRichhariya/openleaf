import bundleAnalyzer from '@next/bundle-analyzer';

import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // Tabs opened on 0.3.0 save through a server action whose id this build can't know
      beforeFiles: [
        {
          source: '/:slug',
          has: [{ type: 'header', key: 'next-action' }],
          destination: '/api/legacy-save',
        },
      ],
    };
  },
  turbopack: {
    rules: {
      // *.svg imports are React components, *.svg?url imports are URLs
      '*.svg': {
        condition: { not: { query: /[?&]url(?=&|$)/ } },
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // For builds with --webpack, which the bundle analyzer needs
  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find(
      (rule: { test?: { test?: (path: string) => boolean } }) => rule.test?.test?.('.svg'),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ['@svgr/webpack'],
      },
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);