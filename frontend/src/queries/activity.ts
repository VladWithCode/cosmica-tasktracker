import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getInbox, getInvitations, markInboxItemRead, markInvitationRead } from "@/api/sharing";
import { queryKeys } from "./keys";

const POLL_MS = 60_000;

export function useInbox() {
    return useQuery({ queryKey: queryKeys.inbox, queryFn: getInbox, refetchInterval: POLL_MS });
}

export function useInvitations() {
    return useQuery({ queryKey: queryKeys.invitations, queryFn: getInvitations, refetchInterval: POLL_MS });
}

export function useUnreadActivityCount(): number {
    const inbox = useInbox().data ?? [];
    const invitations = useInvitations().data ?? [];
    return inbox.filter((item) => !item.readAt).length + invitations.filter((item) => !item.readAt).length;
}

export function useMarkActivityRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ kind, id }: { kind: "inbox" | "invitation"; id: string }) =>
            kind === "inbox" ? markInboxItemRead(id) : markInvitationRead(id),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["activity"] }),
    });
}
