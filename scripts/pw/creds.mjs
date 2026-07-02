// Shared admin credentials for the Playwright dev scripts. NEVER hardcode a real
// login here — read it from the environment so no password is committed to the repo.
//   export PW_EMAIL=you@example.com PW_PASSWORD='…'   # then run the script
export const EMAIL = process.env.PW_EMAIL;
export const PASSWORD = process.env.PW_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    "Missing PW_EMAIL / PW_PASSWORD env vars. Set them before running the Playwright scripts:\n" +
      "  export PW_EMAIL=you@example.com PW_PASSWORD='your-password'",
  );
  process.exit(1);
}
