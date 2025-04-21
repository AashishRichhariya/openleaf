import { Metadata } from 'next';

import { fetchDocument } from '@/server/document-actions';

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
  const document = await fetchDocument(slug);
  const pageContent = document?.content
    ? JSON.stringify(document.content)
    : null;

  return (
    <EditorContainer
      slug={slug}
      initialContent={pageContent}
      isReadOnly={document?.read_only ?? false}
    />
  );
}
