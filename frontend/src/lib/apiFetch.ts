/**
 * apiFetch is a thin wrapper around the global fetch that:
 *  - always sends cookies (credentials: "include"), so the HttpOnly access and
 *    refresh cookies travel with every request;
 *  - transparently refreshes an expired access token: on a 401 it calls
 *    POST /api/v1/auth/refresh once and, if that succeeds, retries the original
 *    request a single time;
 *  - de-duplicates concurrent refreshes (single-flight): if many requests get a
 *    401 at the same time, only one /auth/refresh call is made and the rest wait
 *    for its result.
 *
 * It never attaches tokens to headers and never touches localStorage — auth is
 * cookie-only. It never attempts a refresh for the auth endpoints themselves
 * (login / register / logout / refresh) to avoid loops and to let credential
 * errors surface as-is.
 */

// Auth endpoints that must never trigger an automatic refresh.
const REFRESH_SKIP_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/logout",
    "/api/v1/auth/refresh",
];

// Single-flight guard: the in-progress refresh, shared by all callers.
let refreshInFlight: Promise<boolean> | null = null;

function requestPath(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.pathname;
    if (input instanceof Request) return input.url;
    return String(input);
}

function shouldSkipRefresh(input: RequestInfo | URL): boolean {
    const path = requestPath(input);
    return REFRESH_SKIP_PATHS.some((skip) => path.includes(skip));
}

async function performRefresh(): Promise<boolean> {
    try {
        const response = await fetch("/api/v1/auth/refresh", {
            method: "POST",
            credentials: "include",
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * refreshSession runs at most one refresh at a time. Concurrent callers receive
 * the same promise and therefore the same result.
 */
function refreshSession(): Promise<boolean> {
    if (!refreshInFlight) {
        refreshInFlight = performRefresh().finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

export async function apiFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    const options: RequestInit = { ...init, credentials: "include" };

    const response = await fetch(input, options);

    // Only intercept access-token expiry. Auth endpoints and non-401 responses
    // pass straight through.
    if (response.status !== 401 || shouldSkipRefresh(input)) {
        return response;
    }

    const refreshed = await refreshSession();
    if (!refreshed) {
        // Refresh failed: surface the original 401 so existing flows
        // (route guards / checkAuth) redirect to login as before.
        return response;
    }

    // Retry the original request exactly once with the rotated access cookie.
    // Uses raw fetch so a second 401 cannot recurse into another refresh.
    return fetch(input, options);
}
