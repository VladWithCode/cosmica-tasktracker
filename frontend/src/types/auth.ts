export type UserRole = "user" | "admin" | "superadmin";

export interface User {
    email?: string;
    fullname: string;
    id: string;
    role: UserRole;
    username: string;
}

export interface LoginInput {
    password: string;
    username: string;
}

export interface RegisterInput {
    email?: string;
    fullname: string;
    password: string;
    username: string;
}

export interface AuthResponse {
    data: { user: User } | null;
    error: string | null;
    message: string;
}

export interface ValidationErrorData {
    fields?: Partial<Record<keyof RegisterInput, string>>;
}
