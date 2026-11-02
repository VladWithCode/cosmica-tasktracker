import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useLogin } from "@/queries/session";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
    username: z.string().trim().min(1, "Escribe tu usuario"),
    password: z.string().min(1, "Escribe tu contraseña"),
});

type Values = z.infer<typeof schema>;

export function LoginScreen({ redirect }: { redirect?: string }) {
    const navigate = useNavigate();
    const login = useLogin();
    const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched" });
    const { errors } = form.formState;

    const onSubmit = form.handleSubmit((values) => {
        login.mutate(values, {
            onSuccess: () => {
                if (redirect?.startsWith("/") && !redirect.startsWith("//")) window.location.assign(redirect);
                else navigate({ to: "/" });
            },
        });
    });

    return (
        <AuthLayout
            title="Cosmica"
            subtitle="Tus tareas y rutinas de cada día."
            footer={
                <>
                    ¿No tienes cuenta?{" "}
                    <Link to="/register" className="font-semibold text-accent">
                        Crea una
                    </Link>
                </>
            }
        >
            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                <TextField
                    label="Usuario"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    error={errors.username?.message}
                    {...form.register("username")}
                />
                <TextField label="Contraseña" type="password" autoComplete="current-password" error={errors.password?.message} {...form.register("password")} />
                {login.isError ? (
                    <p role="alert" className="px-1 text-footnote text-danger">
                        {errorMessage(login.error)}
                    </p>
                ) : null}
                <Button type="submit" size="lg" loading={login.isPending} className="mt-2">
                    Iniciar sesión
                </Button>
            </form>
        </AuthLayout>
    );
}
