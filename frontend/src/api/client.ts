import type { z } from "zod";

const AUTH_PATHS = ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/logout", "/api/v1/auth/refresh"];

export class ApiError extends Error {
    readonly status: number;
    readonly code: string | null;
    readonly fields: Record<string, string>;

    constructor(status: number, message: string, code: string | null = null, fields: Record<string, string> = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}

function fieldsOf(envelope: Envelope): Record<string, string> {
    const data = envelope.data;
    if (!data || typeof data !== "object" || !("fields" in data)) return {};
    const fields = (data as { fields: unknown }).fields;
    if (!fields || typeof fields !== "object") return {};
    return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

type Envelope = { data?: unknown; error?: unknown; message?: unknown };

type Query = Record<string, string | number | undefined | null>;

export type RequestOptions<T> = {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    query?: Query;
    schema?: z.ZodType<T>;
    signal?: AbortSignal;
};

let refreshInFlight: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
    onSessionExpired = handler;
}

function refreshSession(): Promise<boolean> {
    refreshInFlight ??= fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
            refreshInFlight = null;
        });
    return refreshInFlight;
}

function buildUrl(path: string, query?: Query): string {
    if (!query) return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const search = params.toString();
    return search ? `${path}?${search}` : path;
}

async function send(url: string, method: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    return fetch(url, {
        method,
        credentials: "include",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
    });
}

async function readEnvelope(response: Response): Promise<Envelope> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as Envelope;
    } catch {
        return {};
    }
}

function messageOf(envelope: Envelope, fallback: string): string {
    if (typeof envelope.message === "string" && envelope.message) return envelope.message;
    if (typeof envelope.error === "string" && envelope.error) return envelope.error;
    return fallback;
}

function codeOf(envelope: Envelope): string | null {
    const { error, message } = envelope;
    if (typeof error !== "string" || error === message) return null;
    return /^[a-z0-9_]+$/.test(error) ? error : null;
}

export async function api<T = unknown>(path: string, options: RequestOptions<T> = {}): Promise<T> {
    const method = options.method ?? "GET";
    const url = buildUrl(path, options.query);
    let response: Response;
    try {
        response = await send(url, method, options.body, options.signal);
        if (response.status === 401 && !AUTH_PATHS.includes(path)) {
            if (await refreshSession()) {
                response = await send(url, method, options.body, options.signal);
            }
            if (response.status === 401) onSessionExpired?.();
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new ApiError(0, "Sin conexión. Revisa tu red e inténtalo de nuevo.");
    }

    const envelope = await readEnvelope(response);
    if (!response.ok) {
        throw new ApiError(response.status, messageOf(envelope, "Ocurrió un error inesperado."), codeOf(envelope), fieldsOf(envelope));
    }

    if (!options.schema) return envelope.data as T;
    const parsed = options.schema.safeParse(envelope.data ?? {});
    if (!parsed.success) {
        console.error(`Respuesta inesperada de ${method} ${path}`, parsed.error);
        throw new ApiError(response.status, "La respuesta del servidor no tiene el formato esperado.");
    }
    return parsed.data;
}

export function errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    return "Ocurrió un error inesperado.";
}
