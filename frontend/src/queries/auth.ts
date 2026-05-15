import { queryOptions } from "@tanstack/react-query";
import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { User } from "@/types/auth";

export const AuthQueryKeys = {
    auth: () => ["auth"] as const,
    checkAuth: () => [...AuthQueryKeys.auth(), "checkAuth"] as const,
    login: () => [...AuthQueryKeys.auth(), "login"] as const,
    logout: () => [...AuthQueryKeys.auth(), "logout"] as const,
} as const;

export type QKQueryCheckAuth = typeof AuthQueryKeys.checkAuth;
export type QKQueryLogin = typeof AuthQueryKeys.login;
export type QKQueryLogout = typeof AuthQueryKeys.logout;

interface SessionData {
    user: User;
}

export const checkAuthOpts = queryOptions({
    queryKey: AuthQueryKeys.checkAuth(),
    queryFn: checkAuth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
});

export async function checkAuth() {
    const response = await fetch("/api/v1/auth/me", {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<SessionData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al verificar autenticación"));
    }
    return data;
}
