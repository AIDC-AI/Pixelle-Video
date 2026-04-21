import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUploader } from './media-uploader';

class MockXMLHttpRequest {
  static requests: MockXMLHttpRequest[] = [];

  method = '';
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  responseText = '';
  status = 0;
  statusText = '';
  url = '';
  upload = {
    onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null,
  };

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send() {
    MockXMLHttpRequest.requests.push(this);
  }

  respond(status: number, response: unknown, statusText = 'OK') {
    this.status = status;
    this.statusText = statusText;
    this.responseText = JSON.stringify(response);
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }
}

const originalXMLHttpRequest = globalThis.XMLHttpRequest;

function createFile(name: string, type: string, size: number): File {
  const file = new File(['content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function Harness({
  accept,
  maxSize,
  onChangeSpy,
}: {
  accept: string;
  maxSize?: number;
  onChangeSpy?: (value: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(null);

  return (
    <MediaUploader
      accept={accept}
      maxSize={maxSize}
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChangeSpy?.(nextValue);
      }}
    />
  );
}

describe('MediaUploader', () => {
  beforeAll(() => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
  });

  afterAll(() => {
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
  });

  beforeEach(() => {
    MockXMLHttpRequest.requests = [];
  });

  it('uploads an image successfully and shows an image preview', async () => {
    render(<Harness accept="image/*" />);

    const input = screen.getByLabelText('Upload media file');
    fireEvent.change(input, {
      target: { files: [createFile('portrait.png', 'image/png', 1024)] },
    });

    expect(MockXMLHttpRequest.requests).toHaveLength(1);
    MockXMLHttpRequest.requests[0].upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    expect(screen.getByLabelText('Upload progress')).toBeInTheDocument();

    MockXMLHttpRequest.requests[0].respond(200, {
      file_url: 'http://localhost:8000/api/files/uploads/portrait.png',
      filename: 'portrait.png',
      path: '/output/uploads/portrait.png',
    });

    expect(await screen.findByAltText('Uploaded preview')).toBeInTheDocument();
  });

  it('uploads a video successfully and shows a video preview', async () => {
    render(<Harness accept="video/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('driver.mp4', 'video/mp4', 1024)] },
    });

    MockXMLHttpRequest.requests[0].respond(200, {
      file_url: 'http://localhost:8000/api/files/uploads/driver.mp4',
      filename: 'driver.mp4',
      path: '/output/uploads/driver.mp4',
    });

    expect(await screen.findByLabelText('Uploaded video preview')).toBeInTheDocument();
  });

  it('uploads audio successfully and shows an audio control', async () => {
    render(<Harness accept="audio/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('voice.mp3', 'audio/mpeg', 1024)] },
    });

    MockXMLHttpRequest.requests[0].respond(200, {
      file_url: 'http://localhost:8000/api/files/uploads/voice.mp3',
      filename: 'voice.mp3',
      path: '/output/uploads/voice.mp3',
    });

    expect(await screen.findByLabelText('Uploaded audio preview')).toBeInTheDocument();
  });

  it('rejects oversized files before uploading', async () => {
    render(<Harness accept="image/*" maxSize={1024} />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('large.png', 'image/png', 2048)] },
    });

    expect(MockXMLHttpRequest.requests).toHaveLength(0);
    expect(await screen.findByText('File exceeds the 0.0 MB limit.')).toBeInTheDocument();
  });

  it('rejects unsupported mime types before uploading', async () => {
    render(<Harness accept="image/*,video/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('notes.txt', 'text/plain', 512)] },
    });

    expect(MockXMLHttpRequest.requests).toHaveLength(0);
    expect(await screen.findByText('Only image/*, video/* files are accepted.')).toBeInTheDocument();
  });

  it('shows a network error when the upload request fails', async () => {
    render(<Harness accept="image/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('portrait.png', 'image/png', 1024)] },
    });

    MockXMLHttpRequest.requests[0].fail();

    expect(await screen.findByText('Upload failed due to a network error.')).toBeInTheDocument();
  });

  it('shows a structured API error message when the upload endpoint rejects the file', async () => {
    render(<Harness accept="image/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('portrait.png', 'image/png', 1024)] },
    });

    MockXMLHttpRequest.requests[0].respond(
      413,
      { detail: { code: 'FILE_TOO_LARGE', message: 'File too large.' } },
      'Payload Too Large'
    );

    expect(await screen.findByText('File too large.')).toBeInTheDocument();
  });

  it('shows a string detail message when the upload endpoint returns a plain detail string', async () => {
    render(<Harness accept="image/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('portrait.png', 'image/png', 1024)] },
    });

    MockXMLHttpRequest.requests[0].respond(415, { detail: 'Unsupported media type' }, 'Unsupported Media Type');

    expect(await screen.findByText('Unsupported media type')).toBeInTheDocument();
  });

  it('shows an abort message when the upload is cancelled mid-flight', async () => {
    render(<Harness accept="image/*" />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('portrait.png', 'image/png', 1024)] },
    });

    MockXMLHttpRequest.requests[0].onabort?.();

    expect(await screen.findByText('Upload was cancelled.')).toBeInTheDocument();
  });

  it('supports drag-and-drop upload interactions', async () => {
    render(<Harness accept="image/*" />);

    const dropzone = screen.getByRole('button', { name: /click or drag a file here/i });
    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [createFile('portrait.png', 'image/png', 1024)],
      },
    });

    MockXMLHttpRequest.requests[0].respond(201, {
      file_url: 'http://localhost:8000/api/files/uploads/portrait.png',
      filename: 'portrait.png',
      path: '/output/uploads/portrait.png',
    });

    expect(await screen.findByAltText('Uploaded preview')).toBeInTheDocument();
  });

  it('can clear an uploaded asset after a successful upload', async () => {
    const onChangeSpy = vi.fn<(value: string | null) => void>();
    render(<Harness accept="image/*" onChangeSpy={onChangeSpy} />);

    fireEvent.change(screen.getByLabelText('Upload media file'), {
      target: { files: [createFile('portrait.png', 'image/png', 1024)] },
    });

    MockXMLHttpRequest.requests[0].respond(200, {
      file_url: 'http://localhost:8000/api/files/uploads/portrait.png',
      filename: 'portrait.png',
      path: '/output/uploads/portrait.png',
    });

    await screen.findByAltText('Uploaded preview');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenLastCalledWith(null);
    });
    expect(screen.queryByAltText('Uploaded preview')).not.toBeInTheDocument();
  });
});
