import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './brand-mark';
import { AppIntlProvider } from '@/lib/i18n';
import zhCnMessages from '../../../messages/zh-CN.json';

function renderBrandMark(ui: ReactElement) {
  localStorage.setItem('skyframe-language-preference', 'zh-CN');

  return render(
    <AppIntlProvider>
      {ui}
    </AppIntlProvider>
  );
}

describe('BrandMark', () => {
  it.each([
    ['sm', '16'],
    ['md', '20'],
    ['lg', '32'],
    ['xl', '64'],
  ] as const)('renders the %s size at %spx', (size, expectedSize) => {
    renderBrandMark(<BrandMark size={size} />);

    const mark = screen.getByRole('img', { name: zhCnMessages.brand.productName });
    expect(mark).toHaveAttribute('width', expectedSize);
    expect(mark).toHaveAttribute('height', expectedSize);
  });

  it('exposes an accessible localized brand label', () => {
    renderBrandMark(<BrandMark />);

    expect(screen.getByRole('img', { name: zhCnMessages.brand.productName })).toBeInTheDocument();
  });

  it('uses unique gradient identifiers for multiple marks on one page', () => {
    const { container } = renderBrandMark(
      <div>
        <BrandMark />
        <BrandMark />
      </div>
    );

    const gradients = [...container.querySelectorAll('linearGradient')];
    const ids = gradients.map((gradient) => gradient.id);

    expect(gradients).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith('pixelle-sky-'))).toBe(true);
  });

  it('includes light and dark gradient token classes', () => {
    renderBrandMark(<BrandMark className="custom-mark" />);

    const mark = screen.getByRole('img', { name: zhCnMessages.brand.productName });
    expect(mark).toHaveClass('custom-mark');
    expect(mark).toHaveClass('[--brand-mark-sky-start:hsl(245_60%_55%)]');
    expect(mark).toHaveClass('[--brand-mark-sky-end:hsl(220_70%_85%)]');
    expect(mark).toHaveClass('dark:[--brand-mark-sky-start:hsl(245_60%_70%)]');
    expect(mark).toHaveClass('dark:[--brand-mark-sky-end:hsl(220_70%_45%)]');
  });
});
