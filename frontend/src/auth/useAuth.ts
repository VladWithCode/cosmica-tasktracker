import { queryClient } from "@/queries/queryClient";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
    return useQuery({
        queryKey: ["session"],
        queryFn: async () => {
            return await (await fetch("/api/v1/check-auth", {
                method: "GET",
                credentials: "include",
            })).json();
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
                const res = await fetch("/api/v1/check-auth", {
                    method: "GET",
                    credentials: "include",
                });
                return await res.json();
            },
        });

        return data.error === undefined;
    } catch (error) {
        return false
    }
}
