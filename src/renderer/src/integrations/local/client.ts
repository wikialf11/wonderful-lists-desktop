import { createLocalClient, LOCAL_USER } from "./localClient";

/**
 * Local replacement for the Supabase client. The app is 100% local: no
 * network, no accounts, no cloud. The rest of the UI keeps the same call
 * style (`from().select()`, `rpc()`, `storage`) so the migration is contained.
 */
export const supabase: any = createLocalClient();

export { LOCAL_USER };
