'use client';

import type { CSSProperties } from 'react';
import DOMPurify from 'isomorphic-dompurify';

type Props = {
  html: string;
  className?: string;
  style?: CSSProperties;
};

export const sanitizeArticleHtml = (html: string) =>
  DOMPurify.sanitize(html || '');

export default function ArticleContent({ html, className, style }: Props) {
  return (
    <div
      className={`article-rich-text ${className || ''}`.trim()}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(html) }}
    />
  );
}
