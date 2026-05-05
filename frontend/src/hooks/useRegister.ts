import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "@/queries/queryClient";
import { registerUser } from "@/services/auth";
import type { RegisterInput } from "@/types/auth";

export function useRegister() {
    const router = useRouter();

    return useMutation({
        mutationFn: (payload: RegisterInput) => registerUser(payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["session"] });
            void queryClient.invalidateQueries({ queryKey: ["auth"] });
            void router.navigate({ to: "/tasks" });
        },
    });
}
