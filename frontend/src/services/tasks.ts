import type { CreateTaskPayload } from "@/types/task-config";

export interface CreateTaskResponse {
    task?: unknown;
    message?: string;
    error?: string;
}

export async function createTask(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
    const response = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
    });
    const data = (await response.json()) as CreateTaskResponse;

    if (!response.ok) {
        throw new Error(data.error || "Error al crear tarea");
    }

    return data;
}
