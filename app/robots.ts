import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],  // Allow all paths by default
        disallow: [
          '/server/',     // Disallow API routes
          '/_next/',   // Disallow Next.js system files
          '/_vercel/',   // Disallow vercel files
        ],
      },
    ],
    host: 'https://openleaf.xyz',
  };
}