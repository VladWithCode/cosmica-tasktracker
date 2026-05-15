import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface MainPlaceholderPageProps {
    title: string;
    description: string;
    icon: string;
}

export function MainPlaceholderPage({ title, description, icon }: MainPlaceholderPageProps) {
    return (
        <main className="relative mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6 pb-36 pt-8">
            <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <section className="relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 shadow-[0_20px_50px_rgba(116,89,247,0.1)]">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-[80px]" />
                <div className="relative">
                    <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-surface-container-high text-primary shadow-[0_0_35px_rgba(175,162,255,0.18)]">
                        <MaterialIcon name={icon} filled className="text-4xl" />
                    </div>
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Routine Ritual
                    </p>
                    <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                        {title}
                    </h2>
                    <p className="mt-3 max-w-md text-sm text-on-surface-variant">{description}</p>
                </div>
            </section>

            <section className="relative mt-5 grid grid-cols-2 gap-4">
                <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <MaterialIcon name="bolt" className="text-tertiary" />
                    <p className="mt-4 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Estado
                    </p>
                    <p className="mt-1 font-headline text-lg font-bold text-on-surface">Activo</p>
                </article>
                <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <MaterialIcon name="auto_awesome" className="text-primary" />
                    <p className="mt-4 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Flujo
                    </p>
                    <p className="mt-1 font-headline text-lg font-bold text-on-surface">Listo</p>
                </article>
            </section>
        </main>
    );
}
