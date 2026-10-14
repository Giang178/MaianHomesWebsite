import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArticleContent from './ArticleContent';

describe('ArticleContent', () => {
  it('shares editorial typography with the authoring preview', () => {
    const { container } = render(<ArticleContent html="<h2>Tổng quan</h2><p>Nội dung</p>" className="prose" />);
    expect(container.firstElementChild).toHaveClass('article-rich-text', 'prose');
    expect(container.querySelector('h2')).toHaveTextContent('Tổng quan');
  });
});