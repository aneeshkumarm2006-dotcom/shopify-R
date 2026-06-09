import { handlers } from "@/lib/auth";

/**
 * NextAuth (Auth.js v5) catch-all route — handles the OAuth sign-in/callback,
 * session, and CSRF endpoints under `/api/auth/*`. Runs on the Node.js runtime
 * (the default) so the `jwt` callback's first-login provisioning can use Mongoose.
 */
export const { GET, POST } = handlers;
