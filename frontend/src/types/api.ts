export interface ApiResponse<TData> {
    data: TData | null;
    error: string | null;
    message: string;
}

export function getApiError<TData>(
    response: ApiResponse<TData>,
    fallbackMessage: string,
): string {
    return response.error || response.message || fallbackMessage;
}
