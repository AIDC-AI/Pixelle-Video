import { describe, expect, it, vi } from 'vitest';

const { redirectSpy } = vi.hoisted(() => ({
  redirectSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectSpy,
}));

import KeysPage from './keys/page';
import AppearancePage from './appearance/page';
import StoragePage from './storage/page';
import AboutPage from './about/page';

describe('settings redirect pages', () => {
  it('redirects /settings/keys to the keys tab', () => {
    KeysPage();
    expect(redirectSpy).toHaveBeenCalledWith('/settings?tab=keys');
  });

  it('redirects /settings/appearance to the appearance tab', () => {
    AppearancePage();
    expect(redirectSpy).toHaveBeenCalledWith('/settings?tab=appearance');
  });

  it('redirects /settings/storage to the storage tab', () => {
    StoragePage();
    expect(redirectSpy).toHaveBeenCalledWith('/settings?tab=storage');
  });

  it('redirects /settings/about to the about tab', () => {
    AboutPage();
    expect(redirectSpy).toHaveBeenCalledWith('/settings?tab=about');
  });
});
