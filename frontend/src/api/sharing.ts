import { api } from "./client";
import {
    grantResponseSchema,
    grantsResponseSchema,
    inboxResponseSchema,
    invitationsResponseSchema,
    sharingUsersResponseSchema,
    type SharingAccessLevel,
} from "./schemas";

export function getGrants() {
    return api("/api/v1/sharing/grants", { schema: grantsResponseSchema });
}

export function getSharedWithMe() {
    return api("/api/v1/sharing/shared-with-me", { schema: grantsResponseSchema });
}

export function searchUsers(query: string, signal?: AbortSignal) {
    return api("/api/v1/sharing/users/search", { query: { q: query }, schema: sharingUsersResponseSchema, signal });
}

export function createGrant(granteeUserId: string, accessLevel: SharingAccessLevel) {
    return api("/api/v1/sharing/grants", {
        method: "POST",
        body: { grantee_user_id: granteeUserId, access_level: accessLevel },
        schema: grantResponseSchema,
    });
}

export function updateGrant(id: string, accessLevel: SharingAccessLevel) {
    return api(`/api/v1/sharing/grants/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: { access_level: accessLevel },
        schema: grantResponseSchema,
    });
}

export async function revokeGrant(id: string): Promise<void> {
    await api(`/api/v1/sharing/grants/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getInvitations() {
    return api("/api/v1/sharing/invitations", { schema: invitationsResponseSchema });
}

export async function markInvitationRead(id: string): Promise<void> {
    await api(`/api/v1/sharing/invitations/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export function getInbox() {
    return api("/api/v1/notifications/inbox", { schema: inboxResponseSchema });
}

export async function markInboxItemRead(id: string): Promise<void> {
    await api(`/api/v1/notifications/inbox/${encodeURIComponent(id)}/read`, { method: "POST" });
}
