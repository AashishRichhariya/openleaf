export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';

import { getRandomAvailableSlug } from '@/server/document-actions';

export default async function Home() {
  const randomSlug = await getRandomAvailableSlug();
  redirect(`/${randomSlug}`);
}
