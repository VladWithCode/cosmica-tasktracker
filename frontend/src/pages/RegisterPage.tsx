import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useRegister } from "@/hooks/useRegister";
import { AuthApiError } from "@/services/auth";

const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/;

const registerSchema = z
    .object({
        confirmPassword: z.string().min(1, "Confirma tu contraseña"),
        email: z
            .string()
            .trim()
            .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
                message: "Ingresa un correo válido",
            }),
        fullname: z
            .string()
            .trim()
            .min(2, "El nombre debe tener al menos 2 caracteres")
            .max(80, "El nombre no puede pasar de 80 caracteres"),
        password: z
            .string()
            .min(8, "La contraseña debe tener al menos 8 caracteres")
            .max(128, "La contraseña no puede pasar de 128 caracteres")
            .regex(/[A-Za-z]/, "Incluye al menos una letra")
            .regex(/[0-9]/, "Incluye al menos un número"),
        username: z
            .string()
            .trim()
            .regex(usernameRegex, "Usa 3-32 caracteres: a-z, 0-9, _ o -"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const registerMutation = useRegister();
    const {
        formState: { errors },
        handleSubmit,
        register,
        setError,
    } = useForm<RegisterFormData>({
        defaultValues: {
            confirmPassword: "",
            email: "",
            fullname: "",
            password: "",
            username: "",
        },
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (values: RegisterFormData) => {
        setServerError(null);

        try {
            await registerMutation.mutateAsync({
                email: values.email.trim() || undefined,
                fullname: values.fullname.trim(),
                password: values.password,
                username: values.username.trim().toLowerCase(),
            });
        } catch (error) {
            if (error instanceof AuthApiError) {
                if (error.fields) {
                    for (const [field, message] of Object.entries(error.fields)) {
                        if (field in values && message) {
                            setError(field as keyof RegisterFormData, { message });
                        }
                    }
                }
                setServerError(error.message);
                return;
            }

            setServerError("No se pudo crear la cuenta. Intenta nuevamente.");
        }
    };

    return (
        <main className="relative flex min-h-dvh h-dvh items-start justify-center overflow-x-clip overflow-y-auto bg-surface px-6 py-10 sm:items-center font-body text-on-surface selection:bg-primary-dim selection:text-on-primary">
            <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 rounded-full bg-tertiary/5 blur-[120px]" />

            <section className="relative w-full max-w-md rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_20px_50px_rgba(116,89,247,0.14)]">
                <div className="mb-7 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-surface-container-high text-primary shadow-[0_0_30px_rgba(175,162,255,0.22)]">
                        <MaterialIcon name="person_add" filled className="text-3xl" />
                    </div>
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        Routine Ritual
                    </p>
                    <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-on-surface">
                        Crear cuenta
                    </h1>
                    <p className="mt-2 text-sm text-on-surface-variant">
                        Configura tu acceso y empieza tu rutina.
                    </p>
                </div>

                {serverError ? (
                    <div className="mb-5 flex items-start gap-3 rounded-lg border border-error-dim/20 bg-error-container/10 p-3 text-sm text-error">
                        <MaterialIcon name="error_outline" className="mt-0.5 text-lg" />
                        <p>{serverError}</p>
                    </div>
                ) : null}

                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <RegisterTextField
                        autoComplete="name"
                        error={errors.fullname?.message}
                        icon="badge"
                        id="fullname"
                        label="Fullname"
                        register={register("fullname")}
                    />
                    <RegisterTextField
                        autoComplete="username"
                        error={errors.username?.message}
                        helper="3-32, a-z 0-9 _ -"
                        icon="alternate_email"
                        id="username"
                        label="Username"
                        register={register("username")}
                    />
                    <RegisterTextField
                        autoComplete="email"
                        error={errors.email?.message}
                        helper="Opcional"
                        icon="mail"
                        id="email"
                        label="Email"
                        register={register("email")}
                        type="email"
                    />
                    <PasswordField
                        error={errors.password?.message}
                        id="password"
                        label="Password"
                        register={register("password")}
                        show={showPassword}
                        toggle={() => setShowPassword((current) => !current)}
                    />
                    <PasswordField
                        error={errors.confirmPassword?.message}
                        id="confirmPassword"
                        label="Confirm password"
                        register={register("confirmPassword")}
                        show={showConfirmPassword}
                        toggle={() => setShowConfirmPassword((current) => !current)}
                    />

                    <Button
                        className="h-14 w-full rounded-full bg-gradient-to-r from-primary to-primary-dim font-label text-sm font-extrabold uppercase tracking-widest text-on-primary shadow-[0_15px_40px_rgba(175,162,255,0.28)] transition-all duration-300 hover:-translate-y-1 hover:opacity-95 active:scale-95"
                        disabled={registerMutation.isPending}
                        type="submit"
                    >
                        {registerMutation.isPending ? (
                            <span className="flex items-center gap-2">
                                <MaterialIcon
                                    name="progress_activity"
                                    className="animate-spin text-xl"
                                />
                                Creando
                            </span>
                        ) : (
                            "Crear cuenta"
                        )}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-on-surface-variant">
                    ¿Ya tenés cuenta?{" "}
                    <Link className="font-bold text-primary transition-colors hover:text-tertiary" to="/login">
                        Iniciar sesión
                    </Link>
                </p>
            </section>
        </main>
    );
}

interface RegisterTextFieldProps {
    autoComplete: string;
    error?: string;
    helper?: string;
    icon: string;
    id: string;
    label: string;
    register: UseFormRegisterReturn;
    type?: "email" | "text";
}

function RegisterTextField({
    autoComplete,
    error,
    helper,
    icon,
    id,
    label,
    register,
    type = "text",
}: RegisterTextFieldProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <label
                    className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                    htmlFor={id}
                >
                    {label}
                </label>
                {helper ? (
                    <span className="text-xs font-medium text-on-surface-variant">{helper}</span>
                ) : null}
            </div>
            <div className="relative">
                <MaterialIcon
                    name={icon}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-primary"
                />
                <Input
                    autoComplete={autoComplete}
                    className="h-14 rounded-lg border-outline-variant/15 bg-surface-container-lowest pl-12 font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-0"
                    id={id}
                    type={type}
                    {...register}
                />
            </div>
            {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
    );
}

interface PasswordFieldProps {
    error?: string;
    id: string;
    label: string;
    register: UseFormRegisterReturn;
    show: boolean;
    toggle: () => void;
}

function PasswordField({ error, id, label, register, show, toggle }: PasswordFieldProps) {
    return (
        <div className="space-y-2">
            <label
                className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                htmlFor={id}
            >
                {label}
            </label>
            <div className="relative">
                <MaterialIcon
                    name="lock"
                    filled
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-primary"
                />
                <Input
                    autoComplete={id === "password" ? "new-password" : "new-password"}
                    className="h-14 rounded-lg border-outline-variant/15 bg-surface-container-lowest pl-12 pr-12 font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-0"
                    id={id}
                    type={show ? "text" : "password"}
                    {...register}
                />
                <button
                    aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-on-surface-variant transition-all duration-300 hover:bg-surface-container-highest hover:text-primary active:scale-95"
                    onClick={toggle}
                    type="button"
                >
                    <MaterialIcon name={show ? "visibility_off" : "visibility"} className="text-xl" />
                </button>
            </div>
            {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
    );
}
