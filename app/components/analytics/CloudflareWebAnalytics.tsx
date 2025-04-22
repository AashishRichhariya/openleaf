import Script from 'next/script';

interface CloudflareWebAnalyticsProps {
  token: string;
}

export default function CloudflareWebAnalytics({ token }: CloudflareWebAnalyticsProps) {
  return (
    <Script 
      id="cloudflare-web-analytics"
      strategy="afterInteractive"
      src="https://static.cloudflareinsights.com/beacon.min.js" 
      data-cf-beacon={`{"token": "${token}"}`}
      defer
    />
  );
}
