import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type {
    LoginInput,
    RegisterInput,
    User,
    ValidationErrorData,
} from "@/types/auth";

interface AuthApiData extends ValidationErrorData {
    user?: User;
}

export class AuthApiError extends Error {
    code: string | null;
    fields: ValidationErrorData["fields"];
    status: number;

    constructor(params: {
        code: string | null;
        fields?: ValidationErrorData["fields"];
        message: string;
        status: number;
    }) {
        super(params.message);
        this.name = "AuthApiError";
        this.code = params.code;
        this.fields = params.fields;
        this.status = params.status;
    }
}

export async function loginUser(payload: LoginInput): Promise<User> {
    return authRequest("/api/v1/auth/login", payload);
}

export async function registerUser(payload: RegisterInput): Promise<User> {
    return authRequest("/api/v1/auth/register", payload);
}

export async function logoutUser(): Promise<string> {
    const response = await fetch("/api/v1/auth/logout", {
        credentials: "include",
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<null>;

    if (!response.ok) {
        throw new AuthApiError({
            code: data.error,
            message: getApiError(data, "No se pudo cerrar sesión"),
            status: response.status,
        });
    }

    return data.message;
}

export async function changePassword(payload: {
    current_password: string;
    new_password: string;
}): Promise<string> {
    const response = await fetch("/api/v1/auth/password", {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
    });
    const data = (await response.json()) as ApiResponse<null>;

    if (!response.ok) {
        throw new AuthApiError({
            code: data.error,
            message: getApiError(data, "No se pudo actualizar la contraseña"),
            status: response.status,
        });
    }

    return data.message;
}

async function authRequest(endpoint: string, payload: LoginInput | RegisterInput): Promise<User> {
    const response = await fetch(endpoint, {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<AuthApiData>;

    if (!response.ok) {
        throw new AuthApiError({
            code: data.error,
            fields: data.data?.fields,
            message: getApiError(data, "No se pudo completar la autenticación"),
            status: response.status,
        });
    }

    if (!data.data?.user) {
        throw new AuthApiError({
            code: "missing_user",
            message: "La respuesta no incluyó el usuario",
            status: response.status,
        });
    }

    return data.data.user;
}
