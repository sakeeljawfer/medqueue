const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.ok;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });

  if (res.status === 401 && retryOn401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, init, false);
  }

  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body.message === 'string') code = body.message;
    } catch {
      // non-JSON error body; keep the status code
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { API_URL };
