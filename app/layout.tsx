import { Geist, Geist_Mono } from 'next/font/google';

import CloudflareWebAnalytics from './components/analytics/CloudflareWebAnalytics';
import UmamiAnalytics from './components/analytics/UmamiAnalytics';
import Navbar from './components/Navbar';

import type { Metadata } from 'next';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'openleaf',
  description: 'A free, open-source, minimalist browser-based rich text editor with markdown support. No signup required - just visit any URL and start writing instantly.',
  keywords: [
    'browser text editor', 
    'no-signup editor', 
    'markdown editor', 
    'minimalist editor', 
    'instant notes', 
    'ephemeral documents', 
    'collaborative editor',
    'real-time text editor',
    'open source editor',
    'temporary notes',
    'online notepad',
    'notes',
    'quick notes',
    'online notes',
    'temp notes',
    'temporary notes',
    'online scratchpad',
    'quick notes tool',
    'browser notepad',
    'instant document sharing',
    'web-based editor',
    'plain text editor',
    'lexical editor', 
  ],
  icons: {
    // Modern browsers - SVG favicons
    icon: [
      { url: '/favicon/animated-favicon-minified.svg', type: 'image/svg+xml' },
      { url: '/favicon/static-favicon-minified.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon.ico' }, // For older browsers
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    // Apple devices
    apple: [
      {
        url: '/favicon/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    // Other device-specific icons
    other: [
      {
        url: '/favicon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/favicon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  },
  manifest: '/favicon/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        <main className="editor-main">
          {children}
          <CloudflareWebAnalytics token={process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN || ''}/>
          <UmamiAnalytics 
            websiteId={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || ''}
            scriptUrl={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || ''}
          />
        </main>
      </body>
    </html>
  );
}
