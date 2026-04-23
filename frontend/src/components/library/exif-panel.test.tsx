import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExifPanel } from './exif-panel';

vi.mock('exifr', () => ({
  parse: vi.fn().mockResolvedValue({
    ExposureTime: '1/120',
    FNumber: 2.8,
    FocalLength: 35,
    ISO: 400,
    LensModel: 'Prime',
    Make: 'Acme',
    Model: 'Cam',
  }),
}));

describe('ExifPanel', () => {
  it('loads and displays EXIF metadata', async () => {
    render(<ExifPanel src="/image.jpg" />);

    expect(screen.getByText('Loading EXIF…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Acme Cam')).toBeInTheDocument());
    expect(screen.getByText('400')).toBeInTheDocument();
  });
});
