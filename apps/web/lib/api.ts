const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("accessToken");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers
    },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({
    success: false,
    error: { message: "Server response was not valid JSON." }
  }));
  if (!response.ok || !payload.success) {
    if (response.status === 401) {
      clearAuthTokens();
    }
    const message = payload.error?.message ?? "Request failed";
    throw new Error(`${message} (${response.status} ${path})`);
  }
  return payload.data as T;
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("refreshToken");
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  window.dispatchEvent(new Event("scan-krwalo:auth-changed"));
}

export function storeAuthTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("accessToken", accessToken);
  window.localStorage.setItem("refreshToken", refreshToken);
  window.dispatchEvent(new Event("scan-krwalo:auth-changed"));
}

export async function logoutUser() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await api("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      });
    }
  } finally {
    clearAuthTokens();
  }
}
