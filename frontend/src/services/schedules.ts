import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { CreateScheduleInput, Schedule } from "@/types/schedule";

interface ScheduleData {
    schedule: Schedule;
}

interface SchedulesData {
    schedules: Schedule[];
}

export async function createSchedule(payload: CreateScheduleInput): Promise<Schedule> {
    const response = await fetch("/api/v1/schedules", {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<ScheduleData>;

    if (!response.ok) {
        throw new Error(getApiError(data, "Error al crear rutina"));
    }
    if (!data.data?.schedule) {
        throw new Error("La respuesta no incluyó la rutina");
    }

    return data.data.schedule;
}

export async function listSchedules(): Promise<Schedule[]> {
    const response = await fetch("/api/v1/schedules", { credentials: "include" });
    const data = (await response.json()) as ApiResponse<SchedulesData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "Error al recuperar rutinas"));
    }
    return data.data?.schedules ?? [];
}

async function postScheduleAction(id: string, action: "pause" | "resume"): Promise<Schedule> {
    const response = await fetch(`/api/v1/schedules/${id}/${action}`, {
        credentials: "include",
        method: "POST",
    });
    const data = (await response.json()) as ApiResponse<ScheduleData>;
    if (!response.ok) {
        throw new Error(getApiError(data, "No se pudo actualizar la rutina"));
    }
    if (!data.data?.schedule) {
        throw new Error("La respuesta no incluyó la rutina");
    }
    return data.data.schedule;
}

export function pauseSchedule(id: string) {
    return postScheduleAction(id, "pause");
}

export function resumeSchedule(id: string) {
    return postScheduleAction(id, "resume");
}

export async function cancelSchedule(id: string): Promise<void> {
    const response = await fetch(`/api/v1/schedules/${id}`, {
        credentials: "include",
        method: "DELETE",
    });
    if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
        throw new Error(getApiError(data ?? ({} as ApiResponse<unknown>), "No se pudo cancelar la rutina"));
    }
}
