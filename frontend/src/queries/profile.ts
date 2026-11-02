import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changePassword, updateProfile } from "@/api/auth";
import type { User } from "@/api/schemas";
import { queryKeys } from "./keys";

export function useUpdateProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { fullname: string; email: string }) => updateProfile(input),
        onSuccess: (profile) => queryClient.setQueryData<User>(queryKeys.session, (user) => (user ? { ...user, ...profile } : profile)),
    });
}

export function useChangePassword() {
    return useMutation({
        mutationFn: ({ current, next }: { current: string; next: string }) => changePassword(current, next),
    });
}
