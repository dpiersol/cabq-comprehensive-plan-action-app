import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true }),
  Placeholder.configure({
    placeholder: "Describe this legislation (required)…",
  }),
];

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className="tiptap-toolbar no-print" role="toolbar" aria-label="Text formatting">
      <button
        type="button"
        className={editor.isActive("paragraph") ? "is-active" : ""}
        onClick={() => editor.chain().focus().setParagraph().run()}
        title="Body text"
      >
        Body
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        H3
      </button>
      <span className="tiptap-toolbar-sep" aria-hidden />
      <button
        type="button"
        className={editor.isActive("bold") ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={editor.isActive("italic") ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={editor.isActive("underline") ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <span className="tiptap-underline">U</span>
      </button>
      <span className="tiptap-toolbar-sep" aria-hidden />
      <button
        type="button"
        className={editor.isActive("bulletList") ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        • List
      </button>
      <button
        type="button"
        className={editor.isActive("orderedList") ? "is-active" : ""}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        1. List
      </button>
      <span className="tiptap-toolbar-sep" aria-hidden />
      <button
        type="button"
        className={editor.isActive("link") ? "is-active" : ""}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev ?? "https://");
          if (url === null) return;
          const t = url.trim();
          if (t === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: t }).run();
        }}
        title="Link"
      >
        Link
      </button>
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().setParagraph().run()
        }
        title="Clear formatting"
      >
        Clear
      </button>
    </div>
  );
}

export interface ActionDescriptionEditorProps {
  id: string;
  value: string;
  onChange: (html: string) => void;
  /** `id` of the visible label element (rich editor has no native label association). */
  labelledBy?: string;
}

export function ActionDescriptionEditor({
  id,
  value,
  onChange,
  labelledBy,
}: ActionDescriptionEditorProps) {
  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-multiline": "true",
        "aria-label": "Legislation description",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value ?? "";
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      className="action-description-editor"
      role="group"
      aria-labelledby={labelledBy}
    >
      <div id={id} className="tiptap-editor-wrap">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} className="tiptap-editor-surface" />
      </div>
    </div>
  );
}
