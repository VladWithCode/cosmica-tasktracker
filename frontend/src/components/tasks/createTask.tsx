import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { PlusIcon } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Collapsible } from "@radix-ui/react-collapsible";
import { CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { queryClient } from "@/queries/queryClient";

const taskSchema = z
    .object({
        title: z.string().min(1, "El título no puede estar vacío").max(255),
        description: z.string().max(512, "La descripción no puede exceder 512 caracteres"),
        startTime: z.iso.time(),
        endTime: z.iso.time(),
        duration: z.union([z.number().positive(), z.nan()]).optional(), // Duration in minutes
        priority: z.number().min(1).max(5).default(3),
        required: z.boolean().default(false),
        repeating: z.boolean().default(false),
        repeatFrequency: z.union([z.string().optional(), z.literal("")]),
        repeatInterval: z.union([z.number(), z.nan()]).optional(),
        repeatWeekdays: z.union([z.array(z.number()), z.nan()]).optional(),
        repeatEndDate: z.union([z.date().optional(), z.literal("")]),
    })
    .refine(
        (data) => {
            // If repeating is true, repeatFrequency is required
            if (data.repeating && !data.repeatFrequency) {
                return false;
            }
            return true;
        },
        {
            message: "La frecuencia de repetición es requerida cuando se activa repetir",
            path: ["repeatFrequency"],
        },
    )
    .refine(
        (data) => {
            // If both start and end times are provided, end should be after start
            if (data.startTime && data.endTime) {
                const [startH, startM] = data.startTime.split(":");
                const [endH, endM] = data.endTime.split(":");
                const start = new Date();
                const end = new Date();
                start.setHours(parseInt(startH), parseInt(startM));
                end.setHours(parseInt(endH), parseInt(endM));
                return end > start;
            }
            return true;
        },
        {
            message: "La hora de fin debe ser posterior a la hora de inicio",
            path: ["endTime"],
        },
    );

type TaskFormData = z.infer<typeof taskSchema>;

export function NewTask() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const form = useForm<TaskFormData>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: "",
            description: "",
            startTime: "",
            endTime: "",
            priority: 3,
            required: false,
            repeating: false,
            repeatFrequency: "",
            repeatWeekdays: [],
            repeatInterval: 0,
            repeatEndDate: undefined,
        },
    });
    const createTask = useMutation({
        mutationFn: (data: TaskFormData) => fetch("http://localhost:8080/api/v1/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
            credentials: "include",
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
    })

    const repeatValue = form.watch("repeating");
    const startTime = form.watch("startTime");
    const endTime = form.watch("endTime");

    // Calculate duration when both times are selected
    useEffect(() => {
        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const durationMs = end.getTime() - start.getTime();
            const durationMinutes = Math.round(durationMs / (1000 * 60));

            if (durationMinutes > 0) {
                form.setValue("duration", durationMinutes);
            }
        }
    }, [startTime, endTime, form]);

    const onSubmit = (data: TaskFormData) => {
        const [startH, startM] = data.startTime.split(":");
        const [endH, endM] = data.endTime.split(":");
        const start = new Date();
        const end = new Date();
        start.setHours(parseInt(startH), parseInt(startM), 0, 0);
        end.setHours(parseInt(endH), parseInt(endM), 0, 0);
        data.startTime = start.toISOString();
        data.endTime = end.toISOString();
        createTask.mutate(data, {
            onSuccess: () => {
                toast.success("La tarea se creó correctamente");
                setDialogOpen(false);
                form.reset();
            },
            onError: (err) => {
                toast.error(err.message || "Ocurrió un error al crear la tarea");
            },
        });
    };

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-x-2 max-w-full">
                <DialogTrigger asChild>
                    <Button size="icon" className="bg-indigo-900 rounded-full p-6">
                        <PlusIcon className="size-6" />
                    </Button>
                </DialogTrigger>
            </div>
            <DialogContent className="flex flex-col">
                <DialogHeader>
                    <DialogTitle>Nueva tarea</DialogTitle>
                </DialogHeader>

                <DialogDescription>Registra una nueva tarea</DialogDescription>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            name="title"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="max-w-full"
                                            placeholder="Escribe el título de la tarea"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            name="description"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Escribe la descripción de la tarea"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="flex items-start gap-x-3 [&>*]:flex-1">
                            <FormField
                                name="repeating"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Repetir</FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="repeatFrequency"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Repetir cada</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            disabled={!repeatValue}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecciona una opción" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="daily">Dia</SelectItem>
                                                <SelectItem value="weekly">Semana</SelectItem>
                                                <SelectItem value="biweekly">
                                                    Bimestral
                                                </SelectItem>
                                                <SelectItem value="monthly">Mensual</SelectItem>
                                                <SelectItem value="bimonthly">
                                                    Bimestral
                                                </SelectItem>
                                                <SelectItem value="yearly">Anual</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="required"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Requerida</FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex items-center gap-x-4">
                            <FormField
                                name="startTime"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hora de inicio</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="time"
                                                placeholder="HH:mm"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="endTime"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hora de fin</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="time"
                                                placeholder="HH:mm"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button type="submit">Crear</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// @ts-ignore
// not used yet
function moreOptions() {
    return (
        <Collapsible open={true}>
            <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost" className="px-0">
                    Más opciones
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent></CollapsibleContent>
        </Collapsible>
    )
}
