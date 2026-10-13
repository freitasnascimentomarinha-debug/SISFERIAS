// Cliente da API do servidor SISFERIAS (server/). A sessão fica em um cookie
// httpOnly, então não há token para guardar no navegador.

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'sisferias',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se o SISFERIAS está em execução.');
  }

  const text = await response.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const message = (data && typeof data === 'object' && data.error) || `Erro ${response.status}`;
    throw new ApiError(response.status, message, data);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T = any>(path: string, body: unknown = {}) => request<T>('PUT', path, body),
  patch: <T = any>(path: string, body: unknown = {}) => request<T>('PATCH', path, body),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
};

/** Faz o download de um arquivo gerado pela API (exportações e backups). */
export function downloadFromApi(path: string) {
  const link = document.createElement('a');
  link.href = `/api${path}`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
