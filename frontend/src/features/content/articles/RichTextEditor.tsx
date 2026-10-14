'use client';

import { useEffect, useRef, useState } from 'react';
import { Extension, mergeAttributes, Node } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { noticeAdmin } from '@/components/admin/admin-dialog-service';

export type EditorImage = {
  media_id: string;
  url: string;
  alt_text?: string;
  caption?: string;
  credit?: string;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figureImage: {
      insertFigureImage: (attributes: Record<string, string>) => ReturnType;
    };
    textAlignment: {
      setTextAlignment: (alignment: 'left' | 'center' | 'right') => ReturnType;
    };
  }
}

const TextAlignment = Extension.create({
  name: 'textAlignment',
  addGlobalAttributes() {
    return [{
      types: ['heading', 'paragraph'],
      attributes: {
        textAlign: {
          default: 'left',
          parseHTML: element => element.getAttribute('data-align') || 'left',
          renderHTML: attributes => ({ 'data-align': attributes.textAlign || 'left' }),
        },
      },
    }];
  },
  addCommands() {
    return {
      setTextAlignment: alignment => ({ commands }) => {
        const headingUpdated = commands.updateAttributes('heading', { textAlign: alignment });
        const paragraphUpdated = commands.updateAttributes('paragraph', { textAlign: alignment });
        return headingUpdated || paragraphUpdated;
      },
    };
  },
});

const HeadingExit = Extension.create({
  name: 'headingExit',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!this.editor.isActive('heading')) return false;
        return this.editor.chain().splitBlock().setParagraph().run();
      },
    };
  },
});

const FigureImage = Node.create({
  name: 'figureImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      mediaId: { default: '' },
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      credit: { default: '' },
      size: { default: 'full' },
      align: { default: 'center' },
    };
  },
  parseHTML() {
    return [{
      tag: 'figure[data-media-id]',
      getAttrs: node => {
        const figure = node as HTMLElement;
        const image = figure.querySelector('img');
        const caption = figure.querySelector('figcaption');
        return {
          mediaId: figure.dataset.mediaId || image?.dataset.mediaId || '',
          src: image?.getAttribute('src') || '',
          alt: image?.getAttribute('alt') || '',
          caption: caption?.getAttribute('data-caption') || caption?.textContent || '',
          credit: caption?.getAttribute('data-credit') || '',
          size: figure.dataset.size || 'full',
          align: figure.dataset.align || 'center',
        };
      },
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const caption = String(HTMLAttributes.caption || '');
    const credit = String(HTMLAttributes.credit || '');
    const captionText = [caption, credit && `Nguồn: ${credit}`].filter(Boolean).join(' — ');
    return [
      'figure',
      mergeAttributes({
        'data-media-id': HTMLAttributes.mediaId,
        'data-size': HTMLAttributes.size,
        'data-align': HTMLAttributes.align,
      }),
      ['img', {
        src: HTMLAttributes.src,
        alt: HTMLAttributes.alt,
        loading: 'lazy',
        'data-media-id': HTMLAttributes.mediaId,
      }],
      ['figcaption', { 'data-caption': caption, 'data-credit': credit }, captionText],
    ];
  },
  addCommands() {
    return {
      insertFigureImage: attributes => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },
});

type Props = {
  value: string;
  onChange: (html: string) => void;
  images?: EditorImage[];
  uploadImage?: (file: File) => Promise<EditorImage>;
  onImageUploaded?: (image: EditorImage) => void;
};

export default function RichTextEditor({
  value,
  onChange,
  images = [],
  uploadImage,
  onImageUploaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imagePrompt, setImagePrompt] = useState({
    active: false,
    image: null as EditorImage | null,
    alt: '',
    caption: '',
    credit: 'Maian Homes',
  });
  const [, setEditorRevision] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          autolink: true,
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      TextAlignment,
      HeadingExit,
      FigureImage,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'article-rich-text article-rich-text-editor-canvas',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    onSelectionUpdate: () => setEditorRevision(revision => revision + 1),
    onTransaction: () => setEditorRevision(revision => revision + 1),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="min-h-80 animate-pulse rounded-xl bg-gray-100" />;

  const button = (label: string, title: string, active: boolean, action: () => void, disabled = false) => (
    <button
      type="button"
      key={title}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={event => event.preventDefault()}
      onClick={action}
      disabled={disabled}
      className={`article-rich-text-toolbar-button h-8 min-h-[32px] px-2 py-1 rounded-md text-xs font-medium transition-all border disabled:opacity-40 select-none ${
        active
          ? 'bg-[#C5A059] text-[#1A1612] border-[#C5A059] font-bold shadow-2xs'
          : 'bg-white text-gray-700 border-[#E8E0D8] hover:border-[#C5A059] hover:bg-[#FAF8F5]'
      }`}
    >{label}</button>
  );

  const editLink = () => {
    const currentHref = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(currentHref || 'https://');
    setLinkPrompt(true);
  };

  const confirmLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run();
    }
    setLinkPrompt(false);
  };

  const triggerImagePrompt = (image: EditorImage) => {
    setImagePrompt({
      active: true,
      image,
      alt: image.alt_text || '',
      caption: image.caption || '',
      credit: image.credit || 'Maian Homes',
    });
  };

  const confirmImagePrompt = () => {
    if (!imagePrompt.image || !imagePrompt.alt.trim()) return;
    const enrichedImage = { ...imagePrompt.image, alt_text: imagePrompt.alt, caption: imagePrompt.caption, credit: imagePrompt.credit };
    onImageUploaded?.(enrichedImage);
    editor.chain().focus().insertFigureImage({
      mediaId: imagePrompt.image.media_id,
      src: imagePrompt.image.url,
      alt: imagePrompt.alt,
      caption: imagePrompt.caption,
      credit: imagePrompt.credit,
      size: 'full',
      align: 'center',
    }).run();
    setImagePrompt(p => ({ ...p, active: false }));
  };

  const handleUpload = async (file?: File) => {
    if (!file || !uploadImage) return;
    setUploading(true);
    try {
      const image = await uploadImage(file);
      triggerImagePrompt(image);
    } catch {
      noticeAdmin('Tải ảnh vào nội dung thất bại. Vui lòng kiểm tra định dạng ảnh và thử lại.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="overflow-visible rounded-2xl border border-[#E8E0D8] bg-white shadow-2xs focus-within:border-[#C5A059] focus-within:ring-2 focus-within:ring-[#C5A059]/20 transition-all article-rich-text-editor">
      <div className="article-rich-text-toolbar">
        {/* Nhóm định dạng văn bản */}
        {button('Đoạn', 'Đoạn văn bản thường', editor.isActive('paragraph'), () => editor.chain().focus().setParagraph().run())}
        {[2, 3, 4].map(level => button(`H${level}`, `Tiêu đề cấp H${level}`, editor.isActive('heading', { level }), () => editor.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run()))}
        <span className="w-[1px] h-4 bg-[#E0D8D0] mx-0.5 shrink-0 self-center hidden sm:inline-block" aria-hidden="true" />

        {/* Nhóm kiểu chữ inline */}
        {button('Đậm', 'Đậm (Ctrl+B)', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
        {button('Nghiêng', 'Nghiêng (Ctrl+I)', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
        {button('Gạch chân', 'Gạch chân (Ctrl+U)', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
        {button('Gạch xóa', 'Gạch xóa', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
        <span className="w-[1px] h-4 bg-[#E0D8D0] mx-0.5 shrink-0 self-center hidden sm:inline-block" aria-hidden="true" />

        {/* Nhóm danh sách & trích dẫn */}
        {button('• Danh sách', 'Danh sách dấu chấm', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
        {button('1. Danh sách', 'Danh sách đánh số', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
        {button('Trích dẫn', 'Khối trích dẫn', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
        <span className="w-[1px] h-4 bg-[#E0D8D0] mx-0.5 shrink-0 self-center hidden sm:inline-block" aria-hidden="true" />

        {/* Nhóm căn lề */}
        {(['left', 'center', 'right'] as const).map(align => button(
          align === 'left' ? 'Căn trái' : align === 'center' ? 'Căn giữa' : 'Căn phải',
          `Căn ${align}`,
          editor.getAttributes('paragraph').textAlign === align || editor.getAttributes('heading').textAlign === align,
          () => editor.chain().focus().setTextAlignment(align).run(),
        ))}
        <span className="w-[1px] h-4 bg-[#E0D8D0] mx-0.5 shrink-0 self-center hidden sm:inline-block" aria-hidden="true" />

        {/* Nhóm liên kết, chèn ảnh & đường kẻ */}
        {button('Liên kết', 'Thêm hoặc sửa liên kết', editor.isActive('link'), editLink)}
        {button('Bỏ link', 'Bỏ liên kết', false, () => editor.chain().focus().unsetLink().run(), !editor.isActive('link'))}
        {button('Ảnh mới', 'Tải và chèn ảnh tại con trỏ', false, () => fileRef.current?.click(), uploading || !uploadImage)}
        {button('Đường kẻ', 'Chèn đường phân cách', false, () => editor.chain().focus().setHorizontalRule().run())}
        <span className="w-[1px] h-4 bg-[#E0D8D0] mx-0.5 shrink-0 self-center hidden sm:inline-block" aria-hidden="true" />

        {/* Nhóm xóa định dạng & hoàn tác */}
        {button('Xóa định dạng', 'Đưa vùng chọn về văn bản thường', false, () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
        {button('Hoàn tác', 'Hoàn tác (Ctrl+Z)', false, () => editor.chain().focus().undo().run(), !editor.can().undo())}
        {button('Làm lại', 'Làm lại', false, () => editor.chain().focus().redo().run(), !editor.can().redo())}

        {editor.isActive('figureImage') && (
          <>
            <span className="w-[1px] h-4 bg-[#E0D8D0] mx-0.5 shrink-0 self-center" aria-hidden="true" />
            {(['small', 'medium', 'full'] as const).map(size => button(
              'Ảnh ' + (size === 'small' ? 'Nhỏ' : size === 'medium' ? 'Vừa' : 'Rộng'),
              'Kích thước ảnh ' + size,
              editor.getAttributes('figureImage').size === size,
              () => editor.chain().focus().updateAttributes('figureImage', { size }).run(),
            ))}
            {(['left', 'center', 'right'] as const).map(align => button(
              'Căn ' + (align === 'left' ? 'trái' : align === 'center' ? 'giữa' : 'phải'),
              'Căn lề ảnh ' + align,
              editor.getAttributes('figureImage').align === align,
              () => editor.chain().focus().updateAttributes('figureImage', { align }).run(),
            ))}
          </>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={event => void handleUpload(event.target.files?.[0])} />
        {images.length > 0 && (
          <select
            aria-label="Chèn ảnh đã tải"
            defaultValue=""
            onChange={event => {
              const image = images.find(item => item.media_id === event.target.value);
              if (image) triggerImagePrompt(image);
              event.target.value = '';
            }}
            className="h-8 min-h-[32px] rounded-md border border-[#E8E0D8] bg-white px-2 text-xs font-semibold text-[#2D1B14] hover:border-[#C5A059] focus:outline-none article-rich-text-image-select"
          >
            <option value="">Chèn ảnh đã tải…</option>
            {images.map((image, index) => <option key={`${image.media_id}-${index}`} value={image.media_id}>Ảnh {index + 1}: {image.alt_text || image.media_id.slice(0, 8)}</option>)}
          </select>
        )}
        {linkPrompt && (
          <div className="absolute top-[110%] left-2 z-30 flex items-center gap-2 rounded-xl border border-[#E8E0D8] bg-white p-2.5 shadow-xl">
            <input 
              type="url" 
              value={linkUrl} 
              onChange={e => setLinkUrl(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && confirmLink()}
              placeholder="https://"
              className="h-9 w-64 rounded-lg border border-[#E8E0D8] px-3 text-sm focus:border-[#C5A059] focus:outline-none"
              autoFocus
            />
            <button type="button" onClick={confirmLink} className="rounded-lg bg-[#C5A059] px-3 py-1.5 text-xs font-bold text-[#1A1612] hover:bg-[#b5924a]">Lưu</button>
            <button type="button" onClick={() => setLinkPrompt(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">Hủy</button>
          </div>
        )}
      </div>
      <EditorContent editor={editor} />

      {imagePrompt.active && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <h3 className="mb-4 text-base font-bold text-[#2D1B14] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C5A059]"></span>
              Thiết lập thuộc tính hình ảnh
            </h3>
            
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">Alt text (Mô tả ảnh cho SEO Google - Bắt buộc) *</label>
            <input type="text" value={imagePrompt.alt} onChange={e => setImagePrompt(p => ({ ...p, alt: e.target.value }))} onKeyDown={e => e.key === 'Enter' && imagePrompt.alt.trim() && confirmImagePrompt()} placeholder="Mô tả nội dung hình ảnh..." className="mb-3.5 w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none" autoFocus />
            
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">Chú thích ảnh (Hiển thị ngay dưới ảnh)</label>
            <input type="text" value={imagePrompt.caption} onChange={e => setImagePrompt(p => ({ ...p, caption: e.target.value }))} onKeyDown={e => e.key === 'Enter' && imagePrompt.alt.trim() && confirmImagePrompt()} placeholder="VD: Phối cảnh dự án The Privé về đêm..." className="mb-3.5 w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none" />
            
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700">Nguồn ảnh / Bản quyền tác giả</label>
            <input type="text" value={imagePrompt.credit} onChange={e => setImagePrompt(p => ({ ...p, credit: e.target.value }))} onKeyDown={e => e.key === 'Enter' && imagePrompt.alt.trim() && confirmImagePrompt()} placeholder="Maian Homes" className="mb-6 w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none" />
            
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setImagePrompt(p => ({ ...p, active: false }))} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">Hủy</button>
              <button type="button" onClick={confirmImagePrompt} disabled={!imagePrompt.alt.trim()} className="btn-gold text-xs font-bold py-2 px-5 shadow-sm disabled:opacity-50">Xác nhận chèn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
