export type SharingAccessLevel = "view" | "manage" | "ping_only";

export interface SharingGrant {
    id: string;
    owner_user_id: string;
    grantee_user_id: string;
    access_level: SharingAccessLevel;
    can_view: boolean;
    can_create: boolean;
    can_edit_tasks: boolean;
    can_ping: boolean;
    owner_username?: string;
    owner_fullname?: string;
    owner_email?: string;
    grantee_username?: string;
    grantee_fullname?: string;
    grantee_email?: string;
    created_at: string;
    updated_at: string;
    revoked_at?: string | null;
}

export interface SharingUser {
    id: string;
    username: string;
    fullname: string;
    email?: string;
}

export interface CreateSharingGrantInput {
    access_level: SharingAccessLevel;
    grantee: string;
}

export interface TaskPing {
    id: string;
    task_id: string;
    sender_user_id: string;
    recipient_user_id: string;
    message?: string;
    notification_sent: boolean;
    created_at: string;
    read_at?: string | null;
}

export interface PingTaskResult {
    ping: TaskPing;
    notification_sent: boolean;
    sent_count: number;
}

export interface NotificationInboxItem {
    id: string;
    task_id: string;
    task_title: string;
    sender_user_id: string;
    sender_username: string;
    sender_fullname: string;
    message?: string;
    notification_sent: boolean;
    created_at: string;
    read_at?: string | null;
}
