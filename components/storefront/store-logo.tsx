import { Icon } from "@/components/ui/icon";

/**
 * Storefront brand wordmark (DESIGN §5.2). A logo image replaces the leaf mark once
 * the merchant uploads one (Stage 9 / Cloudinary); until then a tokenized leaf chip
 * + the store name stands in. `dark` flips it for the inked header/age-gate panels.
 */
export function StoreLogo({
  name = "Northbound",
  logoUrl,
  dark = false,
}: {
  name?: string;
  logoUrl?: string | null;
  dark?: boolean;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ height: 28, width: "auto" }} />;
  }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: dark ? "var(--warm-50)" : "var(--warm-900)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon
          name="leaf"
          size={15}
          style={{ color: dark ? "var(--warm-900)" : "var(--lime-400)" }}
          aria-hidden
        />
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--text-lg)",
          letterSpacing: "-0.01em",
          color: dark ? "var(--warm-50)" : "var(--warm-900)",
        }}
      >
        {name}
      </span>
    </span>
  );
}
