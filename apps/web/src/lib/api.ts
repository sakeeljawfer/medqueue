const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export function saveAuthSession(role: string, accessToken: string) {
  if (typeof window === 'undefined') return;
  const r = role.toLowerCase();
  localStorage.setItem(`mq_token_${r}`, accessToken);
  localStorage.setItem('mq_active_role', role);
  localStorage.setItem('mq_token', accessToken);
}

export function clearAuthSession(role?: string) {
  if (typeof window === 'undefined') return;
  if (role) {
    localStorage.removeItem(`mq_token_${role.toLowerCase()}`);
  } else {
    localStorage.removeItem('mq_token_doctor');
    localStorage.removeItem('mq_token_patient');
    localStorage.removeItem('mq_token_admin');
    localStorage.removeItem('mq_token');
    localStorage.removeItem('mq_active_role');
  }
}

export function getAuthTokenForPath(path: string): string | null {
  if (typeof window === 'undefined') return null;

  const currentPath = window.location.pathname;
  if (path.startsWith('/admin') || currentPath.includes('/admin')) {
    return localStorage.getItem('mq_token_admin') ?? localStorage.getItem('mq_token');
  }
  if (path.startsWith('/doctor') || path.startsWith('/sessions') || currentPath.includes('/doctor')) {
    return (
      localStorage.getItem('mq_token_doctor') ??
      localStorage.getItem('mq_token_admin') ??
      localStorage.getItem('mq_token')
    );
  }
  if (path.startsWith('/appointments') || currentPath.includes('/ticket')) {
    return localStorage.getItem('mq_token_patient') ?? localStorage.getItem('mq_token');
  }

  const activeRole = localStorage.getItem('mq_active_role')?.toLowerCase();
  if (activeRole) {
    const roleToken = localStorage.getItem(`mq_token_${activeRole}`);
    if (roleToken) return roleToken;
  }

  return localStorage.getItem('mq_token');
}

async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (res.ok) {
    try {
      const data = (await res.json()) as { accessToken?: string };
      if (data.accessToken) {
        const activeRole = localStorage.getItem('mq_active_role') ?? 'PATIENT';
        saveAuthSession(activeRole, data.accessToken);
      }
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthTokenForPath(path);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers,
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
