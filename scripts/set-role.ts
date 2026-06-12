/**
 * Operator helper: set a user's role (e.g. grant platform_admin for the operator portal).
 *
 * Usage:  tsx scripts/set-role.ts <email> [merchant|platform_admin]
 * Example: tsx scripts/set-role.ts prem@davnoot.com platform_admin
 */
import mongoose from "mongoose";

function loadEnv() {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  for (const file of [".env.local", ".env"]) {
    try {
      loader?.(file);
    } catch {
      /* file absent — ignore */
    }
  }
}

// Load env BEFORE importing the DB layer (which captures MONGODB_URI at module load).
loadEnv();

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const role = (process.argv[3] ?? "platform_admin").toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/set-role.ts <email> [merchant|platform_admin]");
    process.exit(1);
  }
  if (role !== "merchant" && role !== "platform_admin") {
    console.error(`Invalid role "${role}" — must be "merchant" or "platform_admin".`);
    process.exit(1);
  }

  const { dbConnect, UserModel } = await import("@/lib/db");
  await dbConnect();

  const res = await UserModel.updateOne({ email }, { $set: { role } });
  if (res.matchedCount === 0) {
    console.error(`✗ no user with email "${email}". (Sign in once first so the account exists.)`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✓ set "${email}" → role "${role}"`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ set-role failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
