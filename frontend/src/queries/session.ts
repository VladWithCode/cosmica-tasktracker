import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getSession, login, logout, register, type Credentials, type Registration } from "@/api/auth";
import { useOwnerStore } from "@/stores/owner";
import { queryKeys } from "./keys";

export const sessionQuery = queryOptions({
    queryKey: queryKeys.session,
    queryFn: getSession,
    staleTime: 5 * 60_000,
    retry: false,
});

export function useSession() {
    return useSuspenseQuery(sessionQuery).data;
}

export function useLogin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (credentials: Credentials) => login(credentials),
        onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user),
    });
}

export function useRegister() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: Registration) => register(input),
        onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user),
    });
}

export function useLogout() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: logout,
        onSettled: () => {
            useOwnerStore.getState().setOwner(null);
            queryClient.clear();
        },
    });
}
