import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { toast } from 'sonner';
import {
  setHealthShouldFail,
  setSettings,
  setSettingsWriteShouldFail,
} from '@/tests/msw/handlers';
import { server } from '@/tests/msw/server';
import { useCurrentProjectStore } from '@/stores/current-project';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();
const mockSetTheme = vi.fn();
let mockTheme: 'dark' | 'light' | 'system' | undefined = 'dark';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
      mutations: { retry: false },
    },
  });
}

async function seedCurrentProject(project: { id: string; name: string } | null) {
  if (project) {
    localStorage.setItem(
      'current-project-storage',
      JSON.stringify({
        state: { currentProject: project },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProject: project });

  await act(async () => {
    await useCurrentProjectStore.persist.rehydrate();
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Page />
    </QueryClientProvider>
  );
}

describe('Settings Page', () => {
  beforeEach(async () => {
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    mockSetTheme.mockReset();
    mockTheme = 'dark';
    setHealthShouldFail(false);
    setSettingsWriteShouldFail(false);
    setSettings({
      project_name: 'Demo Project',
      llm: {
        api_key: 'sk-****1234',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
      },
      comfyui: {
        comfyui_url: 'http://127.0.0.1:8188',
        comfyui_api_key: 'cf-****1234',
        runninghub_api_key: 'rh-****1234',
        runninghub_concurrent_limit: 2,
        runninghub_instance_type: 'plus',
      },
      template: {
        default_template: '1080x1920/default.html',
      },
    });
    localStorage.setItem('pixelle-language-preference', 'zh-CN');
    localStorage.setItem('sidebar-collapsed', 'false');
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the keys tab by default with masked settings values', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByTestId('settings-llm-api-key')).toHaveValue('sk-****1234');
    expect(screen.getByDisplayValue('http://127.0.0.1:8188')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('falls back to the keys tab when the URL contains an unknown tab value', async () => {
    mockSearchParams = new URLSearchParams('tab=unknown');

    renderPage();

    expect(await screen.findByText('Project Defaults')).toBeInTheDocument();
    expect(screen.getByLabelText('Breadcrumb')).toHaveTextContent('API Keys');
  });

  it('saves key settings through the real settings endpoint', async () => {
    const user = userEvent.setup();
    renderPage();

    const baseUrlInput = await screen.findByTestId('settings-llm-base-url');
    await user.clear(baseUrlInput);
    await user.type(baseUrlInput, 'https://api.example.com/v2');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved.');
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves project and ComfyUI defaults through the shared save action', async () => {
    const user = userEvent.setup();
    renderPage();

    const projectNameInput = await screen.findByDisplayValue('Demo Project');
    const templateInput = await screen.findByDisplayValue('1080x1920/default.html');
    const comfyEndpointInput = screen.getByTestId('settings-comfyui-url');
    const runningHubConcurrencyInput = screen.getByTestId('settings-runninghub-concurrency');
    const instanceTypeInput = screen.getByTestId('settings-runninghub-instance-type');

    await user.clear(projectNameInput);
    await user.type(projectNameInput, 'Workbench');
    await user.clear(templateInput);
    await user.type(templateInput, '1080x1920/social.html');
    await user.clear(comfyEndpointInput);
    await user.type(comfyEndpointInput, 'http://127.0.0.1:9000');
    await user.clear(runningHubConcurrencyInput);
    await user.type(runningHubConcurrencyInput, '4');
    await user.clear(instanceTypeInput);
    await user.type(instanceTypeInput, 'ultra');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved.');
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('toggles masked secret inputs between hidden and visible states', async () => {
    const user = userEvent.setup();
    renderPage();

    const llmApiKeyInput = await screen.findByTestId('settings-llm-api-key');
    const toggleButton = screen.getByRole('button', { name: 'Show LLM API Key' });

    expect(llmApiKeyInput).toHaveAttribute('type', 'password');
    await user.click(toggleButton);
    expect(llmApiKeyInput).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide LLM API Key' }));
    expect(llmApiKeyInput).toHaveAttribute('type', 'password');
  });

  it('updates URL state when switching tabs from the tab rail', async () => {
    const user = userEvent.setup();
    const firstView = renderPage();

    await user.click(await screen.findByRole('tab', { name: /Appearance/i }));
    expect(mockReplace).toHaveBeenCalledWith('/settings?tab=appearance', { scroll: false });

    firstView.unmount();
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams('tab=appearance');

    renderPage();

    await user.click(screen.getByRole('tab', { name: /API Keys/i }));
    expect(mockReplace).toHaveBeenCalledWith('/settings', { scroll: false });
  });

  it('saves secret provider fields through the shared save action', async () => {
    const user = userEvent.setup();
    renderPage();

    const llmApiKeyInput = await screen.findByTestId('settings-llm-api-key');
    const comfyApiKeyInput = screen.getByTestId('settings-comfyui-api-key');
    const runningHubApiKeyInput = screen.getByTestId('settings-runninghub-api-key');

    await user.click(screen.getByRole('button', { name: 'Show LLM API Key' }));
    await user.click(screen.getByRole('button', { name: 'Show ComfyUI API Key' }));
    await user.click(screen.getByRole('button', { name: 'Show RunningHub API Key' }));

    await user.clear(llmApiKeyInput);
    await user.type(llmApiKeyInput, 'sk-updated-key');
    await user.clear(comfyApiKeyInput);
    await user.type(comfyApiKeyInput, 'cf-updated-key');
    await user.clear(runningHubApiKeyInput);
    await user.type(runningHubApiKeyInput, 'rh-updated-key');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved.');
    });
  });

  it('renders the appearance tab from URL state', async () => {
    mockSearchParams = new URLSearchParams('tab=appearance');
    localStorage.setItem('pixelle-language-preference', 'en-US');
    localStorage.setItem('sidebar-collapsed', 'true');

    renderPage();

    expect(await screen.findByText('Theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapsed by default' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language preference' })).toBeInTheDocument();
  });

  it('saves appearance preferences to local storage and theme state', async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams('tab=appearance');

    renderPage();

    await screen.findByText('Theme');
    await user.click(screen.getByRole('button', { name: 'System' }));
    await user.click(screen.getByRole('button', { name: 'Expanded by default' }));
    await user.click(screen.getByRole('combobox', { name: 'Language preference' }));
    await user.click(await screen.findByText('en-US'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSetTheme).toHaveBeenCalledWith('system');
    expect(localStorage.getItem('pixelle-language-preference')).toBe('en-US');
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
    expect(toast.success).toHaveBeenCalledWith('Settings saved.');
  });

  it('falls back to dark appearance when the runtime theme is undefined', async () => {
    mockSearchParams = new URLSearchParams('tab=appearance');
    mockTheme = undefined;

    renderPage();

    expect(await screen.findByText('Theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveClass('bg-primary');
  });

  it('renders read-only storage paths', async () => {
    mockSearchParams = new URLSearchParams('tab=storage');
    renderPage();

    expect(await screen.findByText('Storage Paths')).toBeInTheDocument();
    expect(screen.getByText('output/')).toBeInTheDocument();
    expect(screen.getByText('output/uploads/')).toBeInTheDocument();
  });

  it('shows storage cleanup as unavailable with the current backend contract', async () => {
    mockSearchParams = new URLSearchParams('tab=storage');
    renderPage();

    expect(await screen.findByText('Storage Stats')).toBeInTheDocument();
    expect(screen.getByText('P4+ once the backend exposes runtime storage metrics.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clean Temporary Files' })).toBeDisabled();
  });

  it('renders about metadata from health and package information', async () => {
    mockSearchParams = new URLSearchParams('tab=about');
    renderPage();

    expect(await screen.findByText('Build & Health')).toBeInTheDocument();
    expect(screen.getByText('Backend Version')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(await screen.findByText('Demo API')).toBeInTheDocument();
    expect(screen.getAllByText('0.1.0').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AIDC-AI/Pixelle-Video'
    );
  });

  it('falls back gracefully when health information is unavailable', async () => {
    mockSearchParams = new URLSearchParams('tab=about');
    setHealthShouldFail(true);

    renderPage();

    expect(await screen.findByText('Backend health information is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  });

  it('shows an error toast when saving settings fails', async () => {
    const user = userEvent.setup();
    setSettingsWriteShouldFail(true);

    renderPage();

    const modelInput = await screen.findByTestId('settings-llm-model');
    await user.clear(modelInput);
    await user.type(modelInput, 'gpt-failure');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update settings.');
    });
  });

  it('shows the backend-unavailable warning when /api/settings cannot be loaded', async () => {
    server.use(
      http.get('http://localhost:8000/api/settings', () =>
        HttpResponse.json(
          { detail: { code: 'SETTINGS_UNAVAILABLE', message: 'Settings unavailable.' } },
          { status: 503 }
        )
      )
    );

    renderPage();

    expect(await screen.findByText('Backend settings are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('The workbench is showing safe defaults until `/api/settings` becomes reachable again.')).toBeInTheDocument();
  });
});
