import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Pressable } from "./Pressable";

export function GroupedSection({ title, footer, children, className }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cn("px-4 py-3", className)}>
            {title ? <h2 className="px-4 pb-1.5 text-footnote font-medium text-label-secondary">{title}</h2> : null}
            <div className="overflow-hidden rounded-card bg-bg-elevated [&>*+*]:border-t [&>*+*]:border-separator">{children}</div>
            {footer ? <div className="px-4 pt-1.5 text-footnote text-label-secondary">{footer}</div> : null}
        </section>
    );
}

type RowProps = {
    icon?: ReactNode;
    label: ReactNode;
    detail?: ReactNode;
    trailing?: ReactNode;
    onPress?: () => void;
    chevron?: boolean;
    tone?: "default" | "accent" | "danger";
    disabled?: boolean;
};

const toneClass = { default: "text-label", accent: "text-accent", danger: "text-danger" } as const;

export function GroupedRow({ icon, label, detail, trailing, onPress, chevron, tone = "default", disabled }: RowProps) {
    const content = (
        <>
            {icon ? <span className="flex size-7 shrink-0 items-center justify-center">{icon}</span> : null}
            <span className={cn("min-w-0 flex-1 truncate text-left text-body", toneClass[tone])}>{label}</span>
            {detail ? <span className="truncate text-body text-label-secondary">{detail}</span> : null}
            {trailing}
            {chevron ? <ChevronRight aria-hidden className="size-5 shrink-0 text-label-tertiary" /> : null}
        </>
    );
    const base = "flex min-h-12 w-full items-center gap-3 px-4 py-2.5";
    if (!onPress) return <div className={base}>{content}</div>;
    return (
        <Pressable pressScale={1} disabled={disabled} onClick={onPress} className={cn(base, "active:bg-fill-secondary disabled:opacity-40")}>
            {content}
        </Pressable>
    );
}
