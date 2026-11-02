import { useQuery } from "@tanstack/react-query";
import { getGrants, getSharedWithMe } from "@/api/sharing";
import { queryKeys } from "./keys";

export function useSharedWithMe() {
    return useQuery({ queryKey: queryKeys.sharedWithMe, queryFn: getSharedWithMe, staleTime: 5 * 60_000 });
}

export function useGrants() {
    return useQuery({ queryKey: queryKeys.grants, queryFn: getGrants });
}
