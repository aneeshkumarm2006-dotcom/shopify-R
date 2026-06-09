import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Full-width storefront media box (DESIGN §2.6 / §5) — reserves its aspect ratio and
 * shows a neutral `--surface-sunken` panel + icon when no image is set, so a store
 * with no photography uploaded yet never looks broken. Unlike the admin `Thumb`
 * (fixed px), this fills its container — the shape product/section grids need.
 */
export function Media({
  src,
  alt = "",
  ratio = "4 / 5",
  radius = "var(--radius-lg)",
  icon = "image",
  iconSize = 30,
  fill,
}: {
  src?: string | null;
  alt?: string;
  ratio?: string;
  radius?: string;
  icon?: IconName;
  iconSize?: number;
  /** Stretch to the parent's height instead of using the aspect ratio. */
  fill?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: fill ? "100%" : undefined,
        aspectRatio: fill ? undefined : ratio,
        borderRadius: radius,
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
        display: "grid",
        placeItems: "center",
        color: "var(--warm-400)",
        overflow: "hidden",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Icon name={icon} size={iconSize} aria-hidden />
      )}
    </div>
  );
}
