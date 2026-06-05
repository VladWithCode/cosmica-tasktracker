import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Calendar } from "@/components/ui/calendar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function AgendaCalendar() {
    const navigate = useNavigate();
    const today = useMemo(() => new Date(), []);
    const [month, setMonth] = useState<Date>(
        () => new Date(today.getFullYear(), today.getMonth(), 1),
    );

    const startMonth = useMemo(
        () => new Date(today.getFullYear() - 5, 0, 1),
        [today],
    );
    const endMonth = useMemo(
        () => new Date(today.getFullYear() + 5, 11, 1),
        [today],
    );

    const goToday = () => {
        const t = new Date();
        setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    };

    const handleSelect = (date: Date | undefined) => {
        if (!date) return;
        navigate({ to: "/agenda", search: { date: toDateString(date) } });
    };

    return (
        <main className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 pb-36 pt-6 sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <div className="relative mb-4 flex w-full items-center justify-between">
                <h2 className="font-display text-xl font-bold text-on-surface">
                    Calendario
                </h2>
                <button
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-label text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
                    onClick={goToday}
                    type="button"
                >
                    <MaterialIcon name="today" className="text-sm" />
                    Hoy
                </button>
            </div>

            <div className="relative w-full rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-2 sm:p-4">
                <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    startMonth={startMonth}
                    endMonth={endMonth}
                    showOutsideDays
                    className="mx-auto"
                />
            </div>

            <p className="mt-4 font-label text-xs text-on-surface-variant">
                Toca un día para abrir su agenda.
            </p>
        </main>
    );
}
