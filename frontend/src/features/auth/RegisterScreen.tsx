import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, errorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useRegister } from "@/queries/session";
import { AuthLayout } from "./AuthLayout";

const schema = z
    .object({
        fullname: z.string().trim().min(2, "Escribe tu nombre").max(80, "Usa máximo 80 caracteres"),
        username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9_-]{3,32}$/, "Usa 3 a 32 caracteres: letras, números, _ o -"),
        email: z.union([z.literal(""), z.email("Correo no válido")]),
        password: z
            .string()
            .min(8, "Usa al menos 8 caracteres")
            .max(128, "Usa máximo 128 caracteres")
            .regex(/[a-zA-Z]/, "Incluye al menos una letra")
            .regex(/\d/, "Incluye al menos un número"),
        confirm: z.string(),
    })
    .refine((values) => values.password === values.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

type Values = z.infer<typeof schema>;

const FIELD_ERROR_CODES = ["username_taken", "email_taken", "validation_error"];

function isFieldError(error: unknown): boolean {
    return error instanceof ApiError && error.code !== null && FIELD_ERROR_CODES.includes(error.code);
}

export function RegisterScreen() {
    const navigate = useNavigate();
    const registerUser = useRegister();
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        mode: "onTouched",
        defaultValues: { fullname: "", username: "", email: "", password: "", confirm: "" },
    });
    const { errors } = form.formState;

    const onSubmit = form.handleSubmit(({ fullname, username, email, password }) => {
        registerUser.mutate(
            { fullname, username, password, email: email || undefined },
            {
                onSuccess: () => navigate({ to: "/" }),
                onError: (error) => {
                    if (!(error instanceof ApiError)) return;
                    if (error.code === "username_taken") form.setError("username", { message: error.message });
                    if (error.code === "email_taken") form.setError("email", { message: error.message });
                    for (const [field, message] of Object.entries(error.fields)) {
                        if (field === "fullname" || field === "username" || field === "email" || field === "password") {
                            form.setError(field, { message });
                        }
                    }
                },
            },
        );
    });

    return (
        <AuthLayout
            title="Crea tu cuenta"
            subtitle="Organiza tu día en minutos."
            footer={
                <>
                    ¿Ya tienes cuenta?{" "}
                    <Link to="/login" className="font-semibold text-accent">
                        Inicia sesión
                    </Link>
                </>
            }
        >
            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                <TextField label="Nombre" autoComplete="name" error={errors.fullname?.message} {...form.register("fullname")} />
                <TextField
                    label="Usuario"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    error={errors.username?.message}
                    {...form.register("username")}
                />
                <TextField label="Correo (opcional)" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
                <TextField label="Contraseña" type="password" autoComplete="new-password" error={errors.password?.message} {...form.register("password")} />
                <TextField label="Confirmar contraseña" type="password" autoComplete="new-password" error={errors.confirm?.message} {...form.register("confirm")} />
                {registerUser.isError && !isFieldError(registerUser.error) ? (
                    <p role="alert" className="px-1 text-footnote text-danger">
                        {errorMessage(registerUser.error)}
                    </p>
                ) : null}
                <Button type="submit" size="lg" loading={registerUser.isPending} className="mt-2">
                    Crear cuenta
                </Button>
            </form>
        </AuthLayout>
    );
}
