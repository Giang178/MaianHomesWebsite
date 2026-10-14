import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArticleDetailClient from './ArticleDetailClient';

describe('ArticleDetailClient table of contents', () => {
  it('connects generated table-of-contents links to rendered heading ids', async () => {
    const { container } = render(
      <ArticleDetailClient
        isPreview
        article={{
          id: 'article-1',
          title: 'Bài viết kiểm thử',
          slug: 'bai-viet-kiem-thu',
          category: 'market',
          sapo: 'Tóm tắt',
          content: '<h2>Tổng quan</h2><p>Nội dung</p><h3>Chi tiết</h3>',
          gallery: [],
          author_name: 'Maian Homes',
        }}
        relatedArticles={[]}
        revisions={[]}
      />,
    );

    expect(await screen.findAllByRole('link', { name: 'Tổng quan' })).not.toHaveLength(0);
    expect(container.querySelector('#heading-0')).toHaveTextContent('Tổng quan');
    expect(container.querySelector('#heading-1')).toHaveTextContent('Chi tiết');
  });
});