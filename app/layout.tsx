import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Geist, Geist_Mono } from 'next/font/google';

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
  description:
    'Your free, open-source, minimalistc, sign-up free browser based text editor',
  icons: {
    // Modern browsers - SVG favicons
    icon: [
      { url: '/favicon/animated-favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon/static-favicon.svg', type: 'image/svg+xml' },
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
          <Analytics />
          <SpeedInsights />
        </main>
      </body>
    </html>
  );
}
