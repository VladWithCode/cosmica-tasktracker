import type { TaskFeedItem } from "@/types/task";

const priorityRank: Record<TaskFeedItem["priority_level"], number> = {
    urgent: 0,
    high: 0,   // legacy: treated as urgent
    medium: 1,
    low: 1,    // legacy: treated as medium/casual
};

export function sortTasksForFeed(tasks: TaskFeedItem[]): TaskFeedItem[] {
    return [...tasks].sort((first, second) => {
        const priorityDelta =
            priorityRank[first.priority_level] - priorityRank[second.priority_level];
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        if (first.is_required !== second.is_required) {
            return first.is_required ? -1 : 1;
        }

        const titleDelta = first.title.localeCompare(second.title, "es-ES", {
            sensitivity: "base",
        });
        if (titleDelta !== 0) {
            return titleDelta;
        }

        return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
    });
}
