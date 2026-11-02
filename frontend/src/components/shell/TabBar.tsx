import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { primaryNav, scrollToTop } from "./nav";

function isActive(pathname: string, to: string) {
    return to === "/" ? pathname === "/" || pathname.startsWith("/tasks") : pathname.startsWith(to);
}

export function TabBar() {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    return (
        <nav aria-label="Principal" className="material-bar fixed inset-x-0 bottom-0 z-40 pb-safe lg:hidden">
            <ul className="mx-auto grid h-[3.25rem] max-w-xl grid-cols-5">
                {primaryNav.map(({ to, label, icon: Icon }) => {
                    const active = isActive(pathname, to);
                    return (
                        <li key={to}>
                            <Link
                                to={to}
                                aria-current={active ? "page" : undefined}
                                onClick={() => {
                                    if (active) scrollToTop();
                                }}
                                className={cn(
                                    "flex h-full flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium active:opacity-60",
                                    active ? "text-accent" : "text-label-secondary",
                                )}
                            >
                                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.2 : 1.7} />
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-separator" />
        </nav>
    );
}

export { isActive };
