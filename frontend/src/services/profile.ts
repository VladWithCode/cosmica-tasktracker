import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { ProfileActionResponse, UpdateProfilePayload, UserProfile } from "@/types/profile";
import { logoutUser } from "@/services/auth";

interface ProfileData {
    profile: UserProfile;
}

export async function getProfile(): Promise<UserProfile> {
    const response = await fetch("/api/v1/profile", {
        method: "GET",
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<ProfileData>;

    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo cargar el perfil"));
    }

    if (!data.data?.profile) {
        throw new Error("La respuesta no incluyó el perfil");
    }

    return data.data.profile;
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
    const data = (await response.json()) as ApiResponse<ProfileData>;

    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo actualizar el perfil"));
    }

    return { message: data.message };
}

export async function logoutProfile(): Promise<ProfileActionResponse> {
    const message = await logoutUser();
    return { message };
}
