import type { ProfileActionResponse, UpdateProfilePayload, UserProfile } from "@/types/profile";

export async function getProfile(): Promise<UserProfile> {
    const response = await fetch("/api/v1/profile", {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as UserProfile | ProfileActionResponse;

    if (!response.ok) {
        throw new Error("error" in data ? data.error || "No se pudo cargar el perfil" : "No se pudo cargar el perfil");
    }

    return data as UserProfile;
}

export async function updateProfile(
    payload: UpdateProfilePayload,
): Promise<ProfileActionResponse> {
    const response = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
    });
    const data = (await response.json()) as ProfileActionResponse;

    if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar el perfil");
    }

    return data;
}

export async function logoutProfile(): Promise<ProfileActionResponse> {
    const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
    });
    const data = (await response.json()) as ProfileActionResponse;

    if (!response.ok) {
        throw new Error(data.error || "No se pudo cerrar sesión");
    }

    return data;
}
