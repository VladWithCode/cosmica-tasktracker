import { Suspense, useState, type ReactNode } from "react";

export function Deferred({ when, children }: { when: boolean; children: ReactNode }) {
    const [mounted, setMounted] = useState(when);
    if (when && !mounted) setMounted(true);
    if (!mounted) return null;
    return <Suspense fallback={null}>{children}</Suspense>;
}
