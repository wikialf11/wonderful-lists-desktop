import { LOCAL_USER } from "@/integrations/local/client";

/**
 * The app is fully local: there is exactly one user on this computer.
 * Components that used `user.id` keep working without an auth screen.
 */
export function useAuth() {
  return {
    session: null,
    user: LOCAL_USER,
    loading: false,
  };
}
