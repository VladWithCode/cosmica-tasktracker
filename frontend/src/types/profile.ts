export interface UserProfile {
    id: string;
    username: string;
    fullname: string;
    email: string;
    role: string;
}

export interface UpdateProfilePayload {
    fullname: string;
    email: string;
}

export interface ProfileActionResponse {
    message?: string;
    error?: string;
}
