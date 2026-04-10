const TOKEN_KEY = 'chub_token';
const USER_KEY = 'chub_user';

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'developer';
  developerId: string;
}

export function getUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredUser; } catch { return null; }
}

export function setUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

/** Get the stored JWT token. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Store a JWT token. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Clear the stored JWT token. */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Clear all auth state. */
export function clearAuth(): void {
  clearToken();
  clearUser();
}

/** Build auth headers if a token is available. */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Handle 401 responses by clearing auth state and redirecting to login. */
function handleUnauthorized(): never {
  clearAuth();
  window.location.href = '/login';
  throw new Error('Session expired');
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), { headers: authHeaders() });
  } catch (err) {
    throw new Error('Network error: could not reach the server. Is it running?');
  }

  if (response.status === 401) handleUnauthorized();

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Server error ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const url = new URL(path, window.location.origin);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error('Network error: could not reach the server. Is it running?');
  }

  if (response.status === 401) handleUnauthorized();

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Server error ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function apiDelete<T>(
  path: string,
): Promise<T> {
  const url = new URL(path, window.location.origin);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch (err) {
    throw new Error('Network error: could not reach the server. Is it running?');
  }

  if (response.status === 401) handleUnauthorized();

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Server error ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}
