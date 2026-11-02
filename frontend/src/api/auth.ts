import { api } from "./client";
import { profileSchema, sessionSchema, type User } from "./schemas";

export type Credentials = { username: string; password: string };
export type Registration = Credentials & { fullname: string; email?: string };

export async function getSession(): Promise<User> {
    return (await api("/api/v1/auth/me", { schema: sessionSchema })).user;
}

export async function login(credentials: Credentials): Promise<User> {
    return (await api("/api/v1/auth/login", { method: "POST", body: credentials, schema: sessionSchema })).user;
}

export async function register(input: Registration): Promise<User> {
    return (await api("/api/v1/auth/register", { method: "POST", body: input, schema: sessionSchema })).user;
}

export async function logout(): Promise<void> {
    await api("/api/v1/auth/logout", { method: "POST" });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api("/api/v1/auth/password", {
        method: "PUT",
        body: { current_password: currentPassword, new_password: newPassword },
    });
}

export async function updateProfile(input: { fullname: string; email: string }): Promise<User> {
    return (await api("/api/v1/profile", { method: "PUT", body: input, schema: profileSchema })).profile;
}
