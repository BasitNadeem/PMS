const TOKEN_KEY = "adminToken";

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

interface AdminTokenPayload {
  email: string;
  isSuperAdmin: boolean;
}

export function decodeToken(): AdminTokenPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload)) as AdminTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
