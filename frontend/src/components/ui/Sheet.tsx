import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";

type SheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    headerAction?: ReactNode;
    children: ReactNode;
};

export function Sheet({ open, onOpenChange, title, description, headerAction, children }: SheetProps) {
    const desktop = useIsDesktop();
    return (
        <Drawer.Root
            open={open}
            onOpenChange={onOpenChange}
            direction={desktop ? "right" : "bottom"}
            shouldScaleBackground={!desktop}
            setBackgroundColorOnScale={false}
            repositionInputs={false}
        >
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-scrim" />
                <Drawer.Content
                    {...(description ? {} : { "aria-describedby": undefined })}
                    className={cn(
                        "fixed z-50 flex flex-col bg-bg outline-none",
                        desktop
                            ? "inset-y-2 right-2 w-[26rem] rounded-sheet shadow-float"
                            : "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-sheet pb-safe",
                    )}
                >
                    {desktop ? null : <Drawer.Handle className="mt-2.5 !h-1.5 !w-9 !bg-label-tertiary/50" />}
                    <header className={cn("flex items-center gap-2 px-4 pb-3", desktop ? "pt-5" : "pt-4")}>
                        <Drawer.Title className="min-w-0 flex-1 truncate text-headline">{title}</Drawer.Title>
                        {headerAction}
                        <Drawer.Close className="-mr-2 min-h-11 px-2 text-callout font-semibold text-accent">Cerrar</Drawer.Close>
                    </header>
                    {description ? <Drawer.Description className="sr-only">{description}</Drawer.Description> : null}
                    <div className="flex-1 overflow-y-auto overscroll-contain pt-2 pb-10">{children}</div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
