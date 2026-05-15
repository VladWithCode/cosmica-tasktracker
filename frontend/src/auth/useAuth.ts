import { queryClient } from "@/queries/queryClient";
import type { ApiResponse } from "@/types/api";
import type { User } from "@/types/auth";
import { useQuery } from "@tanstack/react-query";

interface SessionData {
    user: User;
}

export function useAuth() {
    return useQuery({
        queryKey: ["session"],
        queryFn: async () => {
            const response = await fetch("/api/v1/auth/me", {
                method: "GET",
                credentials: "include",
            });

            return (await response.json()) as ApiResponse<SessionData>;
        },
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// Simple fetch to check if the user is authenticated
export async function checkAuth(): Promise<boolean> {
    try {
        const data = await queryClient.fetchQuery({
            queryKey: ["session"],
            queryFn: async () => {
                const res = await fetch("/api/v1/auth/me", {
                    method: "GET",
                    credentials: "include",
                });
                const data = (await res.json()) as ApiResponse<SessionData>;
                return {
                    data,
                    ok: res.ok,
                };
            },
        });

        return data.ok && data.data.error === null;
    } catch {
        return false;
    }
}
