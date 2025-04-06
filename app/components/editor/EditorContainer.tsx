import Editor from "./Editor";

interface EditorContainerProps {
  slug: string;
  initialContent?: string | null;
  isReadOnly?: boolean;
}

export default async function EditorContainer({
  slug,
  initialContent = null,
  isReadOnly = false,
}: EditorContainerProps) {
  const isNewPage = !initialContent;

  return <Editor initialContent={initialContent} slug={slug} />;
}
