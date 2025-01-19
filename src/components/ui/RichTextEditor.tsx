import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Palette, Link as LinkIcon, X } from 'lucide-react';
import { clsx } from 'clsx';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  className?: string;
}

const colors = [
  '#000000', // Black
  '#5C6B77', // Gray
  '#2563EB', // Blue
  '#059669', // Green
  '#DC2626', // Red
  '#9333EA', // Purple
  '#D97706', // Orange
];

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder,
  error,
  className
}: RichTextEditorProps) {
  const [showLinkModal, setShowLinkModal] = React.useState(false);
  const [linkText, setLinkText] = React.useState('');
  const [linkUrl, setLinkUrl] = React.useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 hover:text-indigo-900 underline'
        }
      })
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: clsx(
          'prose prose-sm max-w-none min-h-[150px] max-h-[400px] overflow-y-auto outline-none',
          error && 'border-red-300 focus:border-red-500 focus:ring-red-500'
        )
      }
    }
  });

  const ToolbarButton = React.useCallback(
    ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'p-2 rounded hover:bg-gray-100 transition-colors relative',
          active && 'bg-gray-100 text-indigo-600 after:content-[""] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-indigo-600 after:rounded-full'
        )}
        title={title}
      >
        {children}
      </button>
    ),
    []
  );

  const handleLinkSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    
    // Validate inputs
    if (!linkUrl) return;

    // If no text is selected and link text is provided
    if (editor.state.selection.empty && linkText) {
      // Insert the text first
      editor.chain().focus().insertContent(linkText).run();
      
      // Get the position where we just inserted text
      const pos = editor.state.selection.from;
      
      // Select the text we just inserted
      editor.chain()
        .setTextSelection({
          from: pos - linkText.length,
          to: pos
        })
        .setLink({ href: linkUrl })
        .run();
    } else {
      // If text is selected, just set the link
      editor.chain()
        .focus()
        .setLink({ href: linkUrl })
        .run();
    }

    // Reset form and close modal
    setLinkUrl('');
    setLinkText('');
    setShowLinkModal(false);
  }, [editor, linkUrl, linkText]);

  const openLinkModal = React.useCallback(() => {
    if (!editor) return;

    // Get current selection text and link if any
    const text = editor?.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ''
    );
    const previousUrl = editor.getAttributes('link').href;

    setLinkText(text);
    setLinkUrl(previousUrl || '');
    setShowLinkModal(true);
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 p-2 flex gap-1 items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-gray-200 mx-1" />
          <ToolbarButton
            onClick={openLinkModal}
            active={editor.isActive('link')}
            title="Add Link"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton
              onClick={() => editor.chain().focus().unsetLink().run()}
              title="Remove Link"
            >
              <X className="w-4 h-4" />
            </ToolbarButton>
          )}
          <div className="w-px bg-gray-200 mx-1" />
          <div className="flex gap-1">
            {colors.map((color) => (
              <button
                key={color}
                className={clsx(
                  'w-5 h-5 rounded-full transition-shadow',
                  editor.isActive('textStyle', { color }) 
                    ? 'ring-2 ring-offset-2 ring-indigo-500'
                    : 'hover:ring-2 hover:ring-offset-2 hover:ring-gray-300'
                )}
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const { from, to } = editor.state.selection;
                  editor
                    .chain()
                    .focus()
                    .setColor(color)
                    .setTextSelection({ from, to })
                    .focus()
                    .run();
                }}
                title={`Set text color to ${color}`}
              />
            ))}
            </div>
        </div>
        <div className="px-4 mt-2">
          <EditorContent editor={editor} placeholder={placeholder} />
        </div>
      </div>
      
      {/* Link Modal */}
      <div className={clsx(
        'fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50',
        !showLinkModal && 'hidden'
      )}>
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Insert Link</h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {editor.state.selection.empty && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link Text
                  </label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={e => setLinkText(e.target.value)}
                    placeholder="Enter link text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                {editor.isActive('link') ? 'Update Link' : 'Insert Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}