export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';

import { findAvailableSlug } from '@/server/document-service';

export default async function Home() {
  const randomSlug = await findAvailableSlug();
  redirect(`/${randomSlug}`);
}
