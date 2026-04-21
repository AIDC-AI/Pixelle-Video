import { http, HttpResponse } from 'msw';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export const handlers = [
  // useSubmitQuick
  http.post(`${baseURL}/api/video/generate/async`, async ({ request }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await request.json() as any;
    if (!body.project_id) {
      return HttpResponse.json({ detail: { code: 'NO_PROJECT', message: 'No project_id' } }, { status: 400 });
    }
    return HttpResponse.json({ id: 'task-123', status: 'pending', progress: 0 });
  }),

  // useTaskPolling
  http.get(`${baseURL}/api/tasks/:taskId`, ({ params }) => {
    const { taskId } = params;
    if (taskId === 'task-123') {
      return HttpResponse.json({ id: 'task-123', status: 'completed', progress: 100, result: { video_url: 'http://test.com/video.mp4' } });
    }
    if (taskId === 'task-fail') {
      return HttpResponse.json({ id: 'task-fail', status: 'failed', progress: 50, error_message: 'Generation failed' });
    }
    if (taskId === 'task-pending') {
      return HttpResponse.json({ id: 'task-pending', status: 'running', progress: 50 });
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
  }),

  // useCancelTask
  http.delete(`${baseURL}/api/tasks/:taskId`, () => {
    return HttpResponse.json({ success: true });
  }),

  // useResources
  http.get(`${baseURL}/api/resources/workflows/tts`, () => {
    return HttpResponse.json({ items: [{ id: 'tts-1', name: 'TTS 1' }] });
  }),
  http.get(`${baseURL}/api/resources/workflows/media`, () => {
    return HttpResponse.json({ items: [{ id: 'media-1', name: 'Media 1' }] });
  }),
  http.get(`${baseURL}/api/resources/workflows/image`, () => {
    return HttpResponse.json({ items: [{ id: 'image-1', name: 'Image 1' }] });
  }),
  http.get(`${baseURL}/api/resources/bgm`, () => {
    return HttpResponse.json({ items: [{ id: 'bgm-1', name: 'BGM 1' }] });
  }),
];
