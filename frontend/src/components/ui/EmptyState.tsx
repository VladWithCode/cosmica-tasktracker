import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
    icon: LucideIcon;
    title: string;
    message?: string;
    action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <Icon aria-hidden className="size-12 text-label-tertiary" strokeWidth={1.5} />
            <h2 className="text-title-2">{title}</h2>
            {message ? <p className="max-w-xs text-callout text-label-secondary">{message}</p> : null}
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}
