export interface ApiError {
  status: number;
  code: string;
  message: string;
}

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseURL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData: ApiError = {
      status: response.status,
      code: 'UNKNOWN_ERROR',
      message: response.statusText || 'An error occurred',
    };
    try {
      const errorBody = await response.json();
      // Handle { detail: { code, message } }
      if (errorBody?.detail && typeof errorBody.detail === 'object') {
        errorData.code = errorBody.detail.code || String(response.status);
        errorData.message = errorBody.detail.message || JSON.stringify(errorBody.detail);
      } 
      // Handle { detail: "string" }
      else if (errorBody?.detail && typeof errorBody.detail === 'string') {
        errorData.code = String(response.status);
        errorData.message = errorBody.detail;
      }
      // Fallback
      else if (errorBody?.message) {
        errorData.code = errorBody.code || String(response.status);
        errorData.message = errorBody.message;
      }
    } catch {
      // Ignore json parse error, fallback to default errorData
    }
    throw errorData;
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
