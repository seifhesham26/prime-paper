import { useSession } from "@/lib/auth-client";

export function useUserRole() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  return {
    role,
    canWrite: role === "dev" || role === "admin",
    isAdmin: role === "dev" || role === "admin",
  };
}
