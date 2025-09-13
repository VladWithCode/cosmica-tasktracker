import { redirect } from "@tanstack/react-router";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { checkAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/tasks")({
    component: RouteComponent,
    beforeLoad: async () => {
        try {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) {
                throw redirect({ to: "/" });
            }
        } catch (error) {
            throw redirect({ to: "/" });
        }
    },
});

function RouteComponent() {
    const date = new Date();
    return (
        <div className="grid grid-cols-1 grid-rows-[auto_1fr] gap-2 h-full w-full bg-gray-200 text-secondary-foreground p-0.5">
            <header className="flex-auto flex h-12 px-4 py-0.5">
                <h1 className="text-xl flex-1 my-auto">
                    <span className="font-medium">Lista de tareas </span>
                    <span className="capitalize">
                        {date.toLocaleDateString("es-MX", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                        })}
                    </span>
                </h1>

                <button className="bg-secondary text-secondary-foreground ml-auto my-auto p-1 rounded-sm shadow">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="4" y1="7" x2="20" y2="7"></line>
                        <line x1="4" y1="12" x2="20" y2="12"></line>
                        <line x1="4" y1="17" x2="20" y2="17"></line>
                    </svg>
                </button>
            </header>
            <div className="row-start-2 col-span-full h-full overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}
