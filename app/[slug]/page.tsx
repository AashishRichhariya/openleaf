import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { readStoredContent } from '@/app/utils/storedDocument';
import { getDocumentBySlug } from '@/server/document-service';
import { isValidSlug } from '@/server/request-utils';

import EditorContainer from '../components/editor/EditorContainer';

interface EditorPageProps {
  params: Promise<{ slug: string }>;
}

type MetadataProps = {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(
  { params }: MetadataProps,
): Promise<Metadata> {
  const { slug } = await params;
  
  return {
    title: `openleaf | ${slug}`,
  };
}

export default async function EditorPage(props: EditorPageProps) {
  const { slug } = await props.params;
  // A slug too long to be stored was never a document
  if (!isValidSlug(slug)) notFound();
  const document = await getDocumentBySlug(slug.toLowerCase());
  const content = readStoredContent(document?.content);
  const pageContent = content?.root.children?.length ? JSON.stringify(content) : null;

  return (
    <EditorContainer
      slug={slug}
      initialContent={pageContent}
      isReadOnly={!!document?.read_only}
      revision={document?.updated_at ?? null}
      saveLog={document?.save_log}
    />
  );
}
