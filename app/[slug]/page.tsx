import { Metadata } from 'next';

import { readStoredContent } from '@/app/utils/storedDocument';
import { getDocumentBySlug } from '@/server/document-service';

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
  const document = await getDocumentBySlug(slug.toLowerCase());
  const content = readStoredContent(document?.content);
  const pageContent = content?.root.children?.length ? JSON.stringify(content) : null;

  return (
    <EditorContainer
      slug={slug}
      initialContent={pageContent}
      isReadOnly={document?.read_only ?? false}
      revision={document?.updated_at ?? null}
      saveLog={document?.save_log}
    />
  );
}
