const TOKEN_KEY = 'chub_token';

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

/** Build auth headers if a token is available. */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Handle 401 responses by clearing token and redirecting to login. */
function handleUnauthorized(): never {
  clearToken();
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
