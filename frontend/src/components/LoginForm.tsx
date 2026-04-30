import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

const loginSchema = z.object({
    username: z.string().min(4, "El usuario debe tener al menos 4 caracteres"),
    password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
    onLoginSuccess?: () => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
                credentials: "include",
            });

            const result = await response.json();

            if (response.ok) {
                toast.success(result.message || "Inicio de sesión exitoso");
                onLoginSuccess?.();
                void router.navigate({ to: "/dashboard" });
            } else {
                toast.error(result.error || "Error al iniciar sesión");
            }
        } catch {
            toast.error("Error de conexión. Por favor intenta nuevamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-6 py-10 font-body text-on-surface selection:bg-primary-dim selection:text-on-primary">
            <div className="pointer-events-none absolute left-1/2 top-12 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 rounded-full bg-tertiary/5 blur-[120px]" />

            <main className="relative w-full max-w-md">
                <section className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-surface-container-high text-primary shadow-[0_0_30px_rgba(175,162,255,0.22)]">
                        <MaterialIcon name="auto_awesome" filled className="text-3xl" />
                    </div>
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Routine Ritual
                    </p>
                    <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                        Bienvenido
                    </h1>
                </section>

                <form
                    className="space-y-5 rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_20px_50px_rgba(116,89,247,0.12)]"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <div className="space-y-2">
                        <label
                            className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                            htmlFor="username"
                        >
                            Usuario
                        </label>
                        <div className="relative">
                            <MaterialIcon
                                name="person"
                                filled
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-primary"
                            />
                            <Input
                                id="username"
                                type="text"
                                autoComplete="username"
                                {...register("username")}
                                className="h-14 rounded-lg border-outline-variant/15 bg-surface-container-lowest pl-12 font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-0"
                                disabled={isLoading}
                            />
                        </div>
                        {errors.username ? (
                            <p className="text-sm text-error">{errors.username.message}</p>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <label
                            className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                            htmlFor="password"
                        >
                            Contraseña
                        </label>
                        <div className="relative">
                            <MaterialIcon
                                name="lock"
                                filled
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-primary"
                            />
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                {...register("password")}
                                className="h-14 rounded-lg border-outline-variant/15 bg-surface-container-lowest pl-12 font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-0"
                                disabled={isLoading}
                            />
                        </div>
                        {errors.password ? (
                            <p className="text-sm text-error">{errors.password.message}</p>
                        ) : null}
                    </div>

                    <Button
                        type="submit"
                        className="h-14 w-full rounded-full bg-gradient-to-r from-primary to-primary-dim font-label text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <MaterialIcon
                                    name="progress_activity"
                                    className="animate-spin text-xl"
                                />
                                Entrando
                            </span>
                        ) : (
                            "Iniciar sesión"
                        )}
                    </Button>
                </form>
            </main>
        </div>
    );
}
