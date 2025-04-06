import { fetchDocument } from "../../lib/document-actions";
import Editor from "../components/editor/Editor";

interface EditorPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditorPage(props: EditorPageProps) {
  const { slug } = await props.params;
  const document = await fetchDocument(slug);
  const pageContent = document?.content
    ? JSON.stringify(document.content)
    : null;
  return <Editor initialContent={pageContent} slug={slug} />;
}
