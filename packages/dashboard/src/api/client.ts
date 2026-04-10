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
    response = await fetch(url.toString());
  } catch (err) {
    throw new Error('Network error: could not reach the server. Is it running?');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Server error ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}
