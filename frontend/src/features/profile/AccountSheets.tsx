import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, errorMessage } from "@/api/client";
import type { User } from "@/api/schemas";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { useChangePassword, useUpdateProfile } from "@/queries/profile";
import { toast } from "@/stores/toast";

const profileSchema = z.object({
    fullname: z.string().trim().min(2, "Escribe tu nombre").max(80, "Usa máximo 80 caracteres"),
    email: z.union([z.literal(""), z.email("Correo no válido")]),
});

export function ProfileSheet({ user, open, onClose }: { user: User; open: boolean; onClose: () => void }) {
    return (
        <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} title="Cuenta" description="Editar nombre y correo">
            {open ? <ProfileForm user={user} onDone={onClose} /> : null}
        </Sheet>
    );
}

function ProfileForm({ user, onDone }: { user: User; onDone: () => void }) {
    const update = useUpdateProfile();
    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        mode: "onTouched",
        defaultValues: { fullname: user.fullname, email: user.email },
    });
    const { errors } = form.formState;
    return (
        <form
            noValidate
            className="flex flex-col gap-4 px-4"
            onSubmit={form.handleSubmit((values) =>
                update.mutate(
                    { fullname: values.fullname, email: values.email.trim().toLowerCase() },
                    {
                        onSuccess: () => {
                            toast.show("Cuenta actualizada");
                            onDone();
                        },
                        onError: (error) => {
                            if (!(error instanceof ApiError)) return;
                            if (error.code === "email_taken") form.setError("email", { message: error.message });
                            if (error.fields.fullname) form.setError("fullname", { message: error.fields.fullname });
                            if (error.fields.email) form.setError("email", { message: error.fields.email });
                        },
                    },
                ),
            )}
        >
            <TextField label="Nombre" autoComplete="name" error={errors.fullname?.message} {...form.register("fullname")} />
            <TextField label="Correo (opcional)" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
            {update.isError && !(update.error instanceof ApiError && (update.error.status === 409 || update.error.status === 422)) ? (
                <p role="alert" className="px-1 text-footnote text-danger">
                    {errorMessage(update.error)}
                </p>
            ) : null}
            <Button type="submit" size="lg" loading={update.isPending}>
                Guardar
            </Button>
        </form>
    );
}

const passwordSchema = z
    .object({
        current: z.string().min(1, "Escribe tu contraseña actual"),
        next: z
            .string()
            .min(8, "Usa al menos 8 caracteres")
            .max(128, "Usa máximo 128 caracteres")
            .regex(/[a-zA-Z]/, "Incluye al menos una letra")
            .regex(/\d/, "Incluye al menos un número"),
        confirm: z.string(),
    })
    .refine((values) => values.next === values.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} title="Cambiar contraseña" description="Cambiar la contraseña de tu cuenta">
            {open ? <PasswordForm onDone={onClose} /> : null}
        </Sheet>
    );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
    const change = useChangePassword();
    const form = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        mode: "onTouched",
        defaultValues: { current: "", next: "", confirm: "" },
    });
    const { errors } = form.formState;
    return (
        <form
            noValidate
            className="flex flex-col gap-4 px-4"
            onSubmit={form.handleSubmit(({ current, next }) =>
                change.mutate(
                    { current, next },
                    {
                        onSuccess: () => {
                            toast.show("Contraseña actualizada");
                            onDone();
                        },
                        onError: (error) => {
                            if (error instanceof ApiError && error.status === 400) form.setError("current", { message: error.message });
                            if (error instanceof ApiError && error.fields.password) form.setError("next", { message: error.fields.password });
                        },
                    },
                ),
            )}
        >
            <TextField label="Contraseña actual" type="password" autoComplete="current-password" error={errors.current?.message} {...form.register("current")} />
            <TextField label="Nueva contraseña" type="password" autoComplete="new-password" error={errors.next?.message} {...form.register("next")} />
            <TextField label="Confirmar contraseña" type="password" autoComplete="new-password" error={errors.confirm?.message} {...form.register("confirm")} />
            {change.isError && !(change.error instanceof ApiError && (change.error.status === 400 || change.error.status === 422)) ? (
                <p role="alert" className="px-1 text-footnote text-danger">
                    {errorMessage(change.error)}
                </p>
            ) : null}
            <Button type="submit" size="lg" loading={change.isPending}>
                Cambiar contraseña
            </Button>
        </form>
    );
}
