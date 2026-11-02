import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 pt-bar pb-safe">
            <div className="flex w-full max-w-sm flex-col gap-8 py-10">
                <div className="flex flex-col items-center gap-4 text-center">
                    <img src="/icon.svg" alt="" className="size-16 rounded-[1.1rem] shadow-float" />
                    <div className="flex flex-col gap-1">
                        <h1 className="text-large-title">{title}</h1>
                        <p className="text-callout text-label-secondary">{subtitle}</p>
                    </div>
                </div>
                {children}
                <p className="text-center text-callout text-label-secondary">{footer}</p>
            </div>
        </main>
    );
}
