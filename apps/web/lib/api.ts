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
    const message = formatErrorMessage(payload.error?.message ?? "Request failed", payload.error?.details);
    throw new Error(`${message} (${response.status} ${path})`);
  }
  return payload.data as T;
}

function formatErrorMessage(message: string, details: unknown) {
  if (!Array.isArray(details)) return message;
  const fieldMessages = details
    .map((detail) => {
      if (!detail || typeof detail !== "object" || !("message" in detail)) return null;
      const item = detail as { path?: unknown; message?: unknown };
      if (typeof item.message !== "string") return null;
      return typeof item.path === "string" && item.path ? `${item.path}: ${item.message}` : item.message;
    })
    .filter(Boolean);
  return fieldMessages.length > 0 ? `${message} ${fieldMessages.join("; ")}` : message;
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
