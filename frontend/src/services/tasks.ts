import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { CreateTaskPayload } from "@/types/task-config";

interface CreatedTaskData {
    task?: unknown;
}

export async function createTask(payload: CreateTaskPayload): Promise<ApiResponse<CreatedTaskData>> {
    const response = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
    });
    const data = (await response.json()) as ApiResponse<CreatedTaskData>;

    if (!response.ok) {
        throw new Error(getApiError(data, "Error al crear tarea"));
    }

    return data;
}
