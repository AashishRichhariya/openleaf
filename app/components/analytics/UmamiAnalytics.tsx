import Script from 'next/script';

interface UmamiAnalyticsProps {
  websiteId: string;
  scriptUrl: string;
}

export default function UmamiAnalytics({ websiteId, scriptUrl }: UmamiAnalyticsProps) {
  return (
    <Script
      id="umami-analytics"
      strategy="afterInteractive"
      src={scriptUrl}
      data-website-id={websiteId}
      defer
    />
  );
}
