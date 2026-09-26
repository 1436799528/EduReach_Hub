import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  Bold, Code, Heading2, Heading3, Image as ImageIcon, Italic,
  Link2, Link2Off, List, ListOrdered, Underline as UnderlineIcon,
  Quote, Redo2, Strikethrough, Trash2, Undo2, Upload,
} from 'lucide-react';
import { sanitizeRichHtml } from '../../lib/html-sanitize';
import { uploadAdminImage } from '../../lib/api';

// Professional rich-text editor for admin-authored content (news bodies,
// event descriptions…). Built on contentEditable + the browser editing
// command API: no external editor dependency, styles confined to what the
// render-side sanitizer allowlists. getValue() always returns sanitized HTML.

type Command = { id: string; label: React.ReactNode; title: string; run: () => void };

export default function AdminRichTextEditor({
  initialValue,
  placeholder,
  onChange,
  minHeight = 260,
}: {
  initialValue?: string;
  placeholder?: string;
  onChange?: (sanitizedHtml: string) => void;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editorRef.current && initialValue && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = sanitizeRichHtml(initialValue);
    }
    // Apply CSS-based styling so produced markup stays sanitizer-friendly.
    try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* older engines */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (onChange && editorRef.current) onChange(sanitizeRichHtml(editorRef.current.innerHTML));
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    try { document.execCommand(command, false, value); } catch { /* ignore */ }
    emit();
  }

  function block(tag: string) {
    exec('formatBlock', tag);
  }

  function addLink() {
    const href = window.prompt('Link URL (https://… or /path):');
    if (!href) return;
    exec('createLink', href);
  }

  async function uploadImageFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Only image files can be inserted.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Images must be 2 MB or smaller.'); return; }
    setUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the image file.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadAdminImage(dataUrl);
      exec('insertImage', uploaded.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function onPaste(event: React.ClipboardEvent) {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) void uploadImageFile(file);
      return;
    }
    const html = event.clipboardData?.getData('text/html');
    if (html) {
      event.preventDefault();
      exec('insertHTML', sanitizeRichHtml(html));
    }
    // Plain-text paste: let the browser handle it, then emit.
  }

  function onEditorClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    const image = target.closest('img');
    setSelectedImage(image instanceof HTMLImageElement ? image : null);
  }

  function sizeSelectedImage(width: string) {
    if (!selectedImage) return;
    selectedImage.style.width = width;
    selectedImage.style.maxWidth = '100%';
    selectedImage.style.height = 'auto';
    emit();
  }

  function removeSelectedImage() {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    emit();
  }

  function getValue(): string {
    return editorRef.current ? sanitizeRichHtml(editorRef.current.innerHTML) : '';
  }

  const commands: Command[] = [
    { id: 'bold', label: <Bold size={14} />, title: 'Bold', run: () => exec('bold') },
    { id: 'italic', label: <Italic size={14} />, title: 'Italic', run: () => exec('italic') },
    { id: 'underline', label: <UnderlineIcon size={14} />, title: 'Underline', run: () => exec('underline') },
    { id: 'strike', label: <Strikethrough size={14} />, title: 'Strikethrough', run: () => exec('strikeThrough') },
    { id: 'h2', label: <Heading2 size={14} />, title: 'Heading', run: () => block('<h2>') },
    { id: 'h3', label: <Heading3 size={14} />, title: 'Subheading', run: () => block('<h3>') },
    { id: 'p', label: <span style={{ font: '700 10px/1 var(--er-font-sans)' }}>P</span>, title: 'Paragraph', run: () => block('<p>') },
    { id: 'ul', label: <List size={14} />, title: 'Bullet list', run: () => exec('insertUnorderedList') },
    { id: 'ol', label: <ListOrdered size={14} />, title: 'Numbered list', run: () => exec('insertOrderedList') },
    { id: 'alignLeft', label: <AlignLeft size={14} />, title: 'Align left', run: () => exec('justifyLeft') },
    { id: 'alignCenter', label: <AlignCenter size={14} />, title: 'Align centre', run: () => exec('justifyCenter') },
    { id: 'alignRight', label: <AlignRight size={14} />, title: 'Align right', run: () => exec('justifyRight') },
    { id: 'alignJustify', label: <AlignJustify size={14} />, title: 'Justify', run: () => exec('justifyFull') },
    { id: 'quote', label: <Quote size={14} />, title: 'Quote', run: () => block('<blockquote>') },
    { id: 'code', label: <Code size={14} />, title: 'Code block', run: () => block('<pre>') },
    { id: 'link', label: <Link2 size={14} />, title: 'Add link', run: addLink },
    { id: 'unlink', label: <Link2Off size={14} />, title: 'Remove link', run: () => exec('unlink') },
    { id: 'undo', label: <Undo2 size={14} />, title: 'Undo', run: () => exec('undo') },
    { id: 'redo', label: <Redo2 size={14} />, title: 'Redo', run: () => exec('redo') },
  ];

  return (
    <div className="admin-rte">
      <div className="admin-rte-toolbar" role="toolbar" aria-label="Formatting">
        {commands.map((command) => (
          <button
            key={command.id}
            type="button"
            className="admin-rte-btn"
            title={command.title}
            aria-label={command.title}
            onMouseDown={(e) => { e.preventDefault(); command.run(); }}
          >
            {command.label}
          </button>
        ))}
        <span className="admin-rte-sep" />
        <select
          className="admin-rte-size"
          aria-label="Font size"
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const sizes: Record<string, string> = { small: '2', normal: '3', large: '5', huge: '7' };
            if (e.target.value) exec('fontSize', sizes[e.target.value]);
            e.target.value = '';
          }}
        >
          <option value="">Size</option>
          <option value="small">Small</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
          <option value="huge">Huge</option>
        </select>
        <label className="admin-rte-color" title="Text colour" aria-label="Text colour">
          <span>A</span>
          <input type="color" defaultValue="#0f172a" onChange={(e) => exec('foreColor', e.target.value)} />
        </label>
        <label className="admin-rte-color" title="Highlight colour" aria-label="Highlight colour">
          <span className="hl">◧</span>
          <input type="color" defaultValue="#fff176" onChange={(e) => exec('hiliteColor', e.target.value)} />
        </label>
        <span className="admin-rte-sep" />
        <button type="button" className="admin-rte-btn" title="Insert image by URL" aria-label="Insert image by URL" onMouseDown={(e) => { e.preventDefault(); const url = window.prompt('Image URL (https://…)'); if (url) exec('insertImage', url); }}>
          <ImageIcon size={14} />
        </button>
        <button type="button" className="admin-rte-btn" title="Upload image (or paste a screenshot)" aria-label="Upload image" disabled={uploading} onMouseDown={(e) => { e.preventDefault(); fileRef.current?.click(); }}>
          <Upload size={14} />
        </button>
      </div>

      {selectedImage && (
        <div className="admin-rte-imgtools" role="group" aria-label="Selected image controls">
          <span>Image selected:</span>
          <button type="button" className="admin-text-btn" onMouseDown={(e) => { e.preventDefault(); sizeSelectedImage('30%'); }}>Small</button>
          <button type="button" className="admin-text-btn" onMouseDown={(e) => { e.preventDefault(); sizeSelectedImage('55%'); }}>Medium</button>
          <button type="button" className="admin-text-btn" onMouseDown={(e) => { e.preventDefault(); sizeSelectedImage('90%'); }}>Large</button>
          <button type="button" className="admin-text-btn danger-text" onMouseDown={(e) => { e.preventDefault(); removeSelectedImage(); }}><Trash2 size={12} /> Remove</button>
        </div>
      )}

      <div
        ref={editorRef}
        className="admin-rte-area"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || 'Rich text content'}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onClick={onEditorClick}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImageFile(file);
          e.target.value = '';
        }}
      />

      {uploading && <p className="admin-rte-status">Uploading image…</p>}
      {error && <p className="admin-rte-status error" role="alert">{error}</p>}
    </div>
  );
}
