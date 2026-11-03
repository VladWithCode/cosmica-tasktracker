import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import type { Grant, SharingAccessLevel } from "@/api/schemas";
import { createGrant, getGrants, getSharedWithMe, revokeGrant, searchUsers, updateGrant } from "@/api/sharing";
import { toast } from "@/stores/toast";
import { queryKeys } from "./keys";

export function useSharedWithMe() {
    return useQuery({ queryKey: queryKeys.sharedWithMe, queryFn: getSharedWithMe, staleTime: 5 * 60_000 });
}

export function useGrants() {
    return useQuery({ queryKey: queryKeys.grants, queryFn: getGrants });
}

export function useSearchUsers(query: string) {
    const trimmed = query.trim();
    return useQuery({
        queryKey: queryKeys.userSearch(trimmed),
        queryFn: ({ signal }) => searchUsers(trimmed, signal),
        enabled: trimmed.length >= 2,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

export function useCreateGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, level }: { userId: string; level: SharingAccessLevel }) => createGrant(userId, level),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.grants }),
    });
}

export function useUpdateGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, level }: { id: string; level: SharingAccessLevel }) => updateGrant(id, level),
        onSuccess: (grant) => queryClient.setQueryData<Grant[]>(queryKeys.grants, (list) => list?.map((item) => (item.id === grant.id ? grant : item))),
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.grants }),
    });
}

export function useRevokeGrantWithUndo() {
    const queryClient = useQueryClient();
    const revoke = useMutation({
        mutationFn: (id: string) => revokeGrant(id),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.grants }),
    });
    return (grant: Grant) => {
        const previous = queryClient.getQueryData<Grant[]>(queryKeys.grants);
        queryClient.setQueryData<Grant[]>(queryKeys.grants, (list) => list?.filter((item) => item.id !== grant.id));
        const restore = () => {
            if (previous) queryClient.setQueryData(queryKeys.grants, previous);
        };
        toast.show(`Acceso retirado a ${grant.grantee.fullname || grant.grantee.username}`, {
            duration: 5000,
            action: { label: "Deshacer", onAction: restore },
            onExpire: () =>
                revoke.mutate(grant.id, {
                    onError: (error) => {
                        restore();
                        toast.error(errorMessage(error));
                    },
                }),
        });
    };
}
