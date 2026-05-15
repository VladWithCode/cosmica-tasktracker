import type { ApiResponse } from "@/types/api";
import { getApiError } from "@/types/api";
import type { CreateScheduleInput, Schedule } from "@/types/schedule";

interface ScheduleData {
    schedule: Schedule;
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
