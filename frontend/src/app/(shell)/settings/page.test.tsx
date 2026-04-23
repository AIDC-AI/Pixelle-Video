import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { AppIntlProvider } from '@/lib/i18n';
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
        state: { currentProjectId: project.id },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProjectId: project?.id ?? null });

  await act(async () => {
    await useCurrentProjectStore.persist.rehydrate();
  });
}

function renderPage() {
  return render(
    <AppIntlProvider>
      <QueryClientProvider client={createQueryClient()}>
        <Page />
      </QueryClientProvider>
    </AppIntlProvider>
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
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    localStorage.setItem('sidebar-collapsed', 'false');
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the keys tab by default with masked settings values', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(await screen.findByTestId('settings-llm-api-key')).toHaveValue('sk-****1234');
    expect(screen.getByDisplayValue('http://127.0.0.1:8188')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('renders user-facing chinese labels for keys and storage', async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('tab=storage');

    renderPage();

    expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /资源存放/ })).toBeInTheDocument();
    expect(screen.getByText('资源存放位置')).toBeInTheDocument();
    expect(screen.getByText('生成结果')).toBeInTheDocument();
    expect(screen.getByText('临时缓存')).toBeInTheDocument();
    expect(screen.getByText('上传素材')).toBeInTheDocument();
  });

  it('renders chinese helper copy on the keys tab without raw API labels', async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('tab=keys');

    renderPage();

    expect(await screen.findByText('默认创作设置')).toBeInTheDocument();
    expect(screen.getByText('新建任务时默认带入这个项目名称，方便快速开始。')).toBeInTheDocument();
    expect(screen.getByText('未单独指定时，新的画面渲染会优先使用这个模板。')).toBeInTheDocument();
    expect(screen.queryByText('API Keys')).not.toBeInTheDocument();
    expect(screen.queryByText('Base URL')).not.toBeInTheDocument();
  });

  it('falls back to the keys tab when the URL contains an unknown tab value', async () => {
    mockSearchParams = new URLSearchParams('tab=unknown');

    renderPage();

    expect(await screen.findByText('默认创作设置')).toBeInTheDocument();
    expect(screen.getByLabelText('Breadcrumb')).toHaveTextContent('接口与凭证');
  });

  it('saves key settings through the real settings endpoint', async () => {
    const user = userEvent.setup();
    renderPage();

    const baseUrlInput = await screen.findByTestId('settings-llm-base-url');
    await user.clear(baseUrlInput);
    await user.type(baseUrlInput, 'https://api.example.com/v2');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('设置已保存。');
    });
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('saves project and ComfyUI defaults through the shared save action', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
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
    await user.click(instanceTypeInput);
    await user.click(await screen.findByRole('option', { name: '平台默认 / 自动' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('设置已保存。');
    });

    expect(screen.getByTestId('settings-runninghub-instance-type')).toHaveTextContent('平台默认 / 自动');
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('toggles masked secret inputs between hidden and visible states', async () => {
    const user = userEvent.setup();
    renderPage();

    const llmApiKeyInput = await screen.findByTestId('settings-llm-api-key');
    const toggleButton = screen.getAllByRole('button', { name: '显示 访问密钥' })[0];

    expect(llmApiKeyInput).toHaveAttribute('type', 'password');
    await user.click(toggleButton);
    expect(llmApiKeyInput).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: '隐藏 访问密钥' }));
    expect(llmApiKeyInput).toHaveAttribute('type', 'password');
  });

  it('updates URL state when switching tabs from the tab rail', async () => {
    const user = userEvent.setup();
    const firstView = renderPage();

    await user.click(await screen.findByRole('tab', { name: /外观/ }));
    expect(mockReplace).toHaveBeenCalledWith('/settings?tab=appearance', { scroll: false });

    firstView.unmount();
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams('tab=appearance');

    renderPage();

    await user.click(screen.getByRole('tab', { name: /接口与凭证/ }));
    expect(mockReplace).toHaveBeenCalledWith('/settings', { scroll: false });
  });

  it('saves secret provider fields through the shared save action', async () => {
    const user = userEvent.setup();
    renderPage();

    const llmApiKeyInput = await screen.findByTestId('settings-llm-api-key');
    const comfyApiKeyInput = screen.getByTestId('settings-comfyui-api-key');
    const runningHubApiKeyInput = screen.getByTestId('settings-runninghub-api-key');

    await user.click(screen.getAllByRole('button', { name: '显示 访问密钥' })[0]);
    await user.click(screen.getAllByRole('button', { name: '显示 访问密钥' })[0]);
    await user.click(screen.getAllByRole('button', { name: '显示 访问密钥' })[0]);

    await user.clear(llmApiKeyInput);
    await user.type(llmApiKeyInput, 'sk-updated-key');
    await user.clear(comfyApiKeyInput);
    await user.type(comfyApiKeyInput, 'cf-updated-key');
    await user.clear(runningHubApiKeyInput);
    await user.type(runningHubApiKeyInput, 'rh-updated-key');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('设置已保存。');
    });
  });

  it('validates LLM and RunningHub providers with inline diagnostics', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('settings-llm-verify'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-llm-status')).toHaveTextContent('已验证');
    });
    expect(screen.getByTestId('settings-llm-result')).toHaveTextContent('LLM credentials verified.');
    expect(screen.getByTestId('settings-llm-result')).toHaveTextContent('可用模型数');

    await user.click(screen.getByTestId('settings-runninghub-verify'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-runninghub-status')).toHaveTextContent('已验证');
    });
    expect(screen.getByTestId('settings-runninghub-result')).toHaveTextContent('RunningHub credentials verified.');
    expect(screen.getByTestId('settings-runninghub-result')).toHaveTextContent('剩余余额');
  });

  it('marks only the edited provider as stale after validation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('settings-llm-verify'));
    await user.click(screen.getByTestId('settings-runninghub-verify'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-llm-status')).toHaveTextContent('已验证');
      expect(screen.getByTestId('settings-runninghub-status')).toHaveTextContent('已验证');
    });

    const baseUrlInput = screen.getByTestId('settings-llm-base-url');
    await user.clear(baseUrlInput);
    await user.type(baseUrlInput, 'https://api.example.com/v2');

    expect(screen.getByTestId('settings-llm-status')).toHaveTextContent('需重新验证');
    expect(screen.getByTestId('settings-runninghub-status')).toHaveTextContent('已验证');
  });

  it('renders the appearance tab from URL state', async () => {
    mockSearchParams = new URLSearchParams('tab=appearance');
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    localStorage.setItem('sidebar-collapsed', 'true');

    renderPage();

    expect(await screen.findByText('主题')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '默认折叠' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '语言' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /AI Real-time Preview/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('persists AI feature switches from the appearance tab', async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams('tab=appearance');

    renderPage();

    await user.click(await screen.findByRole('switch', { name: /AI Real-time Preview/ }));
    await user.click(screen.getByRole('switch', { name: /AI Prompt Assist/ }));

    expect(localStorage.getItem('pixelle-ai-preview-enabled')).toBe('true');
    expect(localStorage.getItem('pixelle-ai-prompt-assist-enabled')).toBe('true');
  });

  it('saves appearance preferences to local storage and theme state', async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams('tab=appearance');

    renderPage();

    await screen.findByText('主题');
    await waitFor(() => {
      expect(document.title).toBe('像影 Pixelle · AI 视频创作平台');
    });
    await user.click(screen.getByRole('button', { name: '跟随系统' }));
    await user.click(screen.getByRole('button', { name: '默认展开' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(mockSetTheme).toHaveBeenCalledWith('system');
    expect(localStorage.getItem('skyframe-language-preference')).toBe('zh-CN');
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
    expect(toast.success).toHaveBeenCalledWith('设置已保存。');
    await waitFor(() => {
      expect(document.title).toBe('像影 Pixelle · AI 视频创作平台');
    });
  });

  it('falls back to dark appearance when the runtime theme is undefined', async () => {
    mockSearchParams = new URLSearchParams('tab=appearance');
    mockTheme = undefined;

    renderPage();

    expect(await screen.findByText('主题')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '深色' })).toHaveClass('bg-primary');
  });

  it('renders read-only storage paths', async () => {
    mockSearchParams = new URLSearchParams('tab=storage');
    renderPage();

    expect(await screen.findByText('资源存放位置')).toBeInTheDocument();
    expect(await screen.findByText('output/')).toBeInTheDocument();
    expect(await screen.findByText('output/uploads/')).toBeInTheDocument();
  });

  it('shows live storage metrics and allows cleanup', async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams('tab=storage');
    renderPage();

    expect(await screen.findByText('空间占用')).toBeInTheDocument();
    expect(await screen.findByText('Video')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清理临时缓存' }));
    expect(await screen.findByRole('heading', { name: '确认清理存储' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认清理' }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('已删除 3 个文件，释放 4.0 MB。');
    });
  });

  it('renders about metadata from health and package information', async () => {
    mockSearchParams = new URLSearchParams('tab=about');
    renderPage();

    expect(await screen.findByText('构建与健康状态')).toBeInTheDocument();
    expect(screen.getAllByText('像影 Pixelle').length).toBeGreaterThan(0);
    expect(screen.getByText('后端版本')).toBeInTheDocument();
    expect(screen.getByText('Node.js 版本')).toBeInTheDocument();
    expect(screen.getByText('服务名')).toBeInTheDocument();
    expect(await screen.findByText('Demo API')).toBeInTheDocument();
    expect(screen.getAllByText('0.1.0').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AIDC-AI/Pixelle-Video'
    );
    expect(screen.getByRole('button', { name: '许可证' })).toHaveAttribute(
      'href',
      'https://www.apache.org/licenses/LICENSE-2.0'
    );
  });

  it('falls back gracefully when health information is unavailable', async () => {
    mockSearchParams = new URLSearchParams('tab=about');
    setHealthShouldFail(true);

    renderPage();

    expect(await screen.findByText('后端健康状态信息暂时不可用。')).toBeInTheDocument();
    expect(screen.getAllByText('未上报').length).toBeGreaterThan(0);
    expect(screen.getByText('降级')).toBeInTheDocument();
  });

  it('shows an error toast when saving settings fails', async () => {
    const user = userEvent.setup();
    setSettingsWriteShouldFail(true);

    renderPage();

    const modelInput = await screen.findByTestId('settings-llm-model');
    await user.clear(modelInput);
    await user.type(modelInput, 'gpt-failure');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

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

    expect(await screen.findByText('后端设置暂不可用')).toBeInTheDocument();
    expect(screen.getByText('在 `/api/settings` 恢复可访问之前，工作台会先显示安全的默认值。')).toBeInTheDocument();
  });
});
