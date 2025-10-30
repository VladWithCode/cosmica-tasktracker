import { queryOptions } from "@tanstack/react-query";

export const AuthQueryKeys = {
    auth: () => ["auth"] as const,
    checkAuth: () => [...AuthQueryKeys.auth(), "checkAuth"] as const,
    login: () => [...AuthQueryKeys.auth(), "login"] as const,
    logout: () => [...AuthQueryKeys.auth(), "logout"] as const,
} as const;

export type QKQueryCheckAuth = typeof AuthQueryKeys.checkAuth;
export type QKQueryLogin = typeof AuthQueryKeys.login;
export type QKQueryLogout = typeof AuthQueryKeys.logout;

export const checkAuthOpts = queryOptions({
    queryKey: AuthQueryKeys.checkAuth(),
    queryFn: checkAuth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
});

export async function checkAuth() {
    const response = await fetch("/api/v1/check-auth", {
        method: "GET",
        credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error al verificar autenticación");
    }
    return data;
}
