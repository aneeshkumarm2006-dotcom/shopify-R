import Image from "next/image";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Full-width storefront media box (DESIGN §2.6 / §5) — reserves its aspect ratio and
 * shows a neutral `--surface-sunken` panel + icon when no image is set, so a store
 * with no photography uploaded yet never looks broken. Unlike the admin `Thumb`
 * (fixed px), this fills its container — the shape product/section grids need.
 *
 * Images go through `next/image` (Cloudinary is allowlisted in next.config): lazy by
 * default, responsive `srcset` via `sizes`, and AVIF/WebP negotiation — so a phone
 * never downloads a desktop-size original. Pass `priority` for an above-the-fold hero
 * (e.g. the PDP main image) to opt out of lazy-loading.
 */
export function Media({
  src,
  alt = "",
  ratio = "4 / 5",
  radius = "var(--radius-lg)",
  icon = "image",
  iconSize = 30,
  fill,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px",
  priority = false,
}: {
  src?: string | null;
  alt?: string;
  ratio?: string;
  radius?: string;
  icon?: IconName;
  iconSize?: number;
  /** Stretch to the parent's height instead of using the aspect ratio. */
  fill?: boolean;
  /** Responsive-image hint; tune per context (grid vs PDP). */
  sizes?: string;
  /** Skip lazy-loading for an above-the-fold image. */
  priority?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
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
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <Icon name={icon} size={iconSize} aria-hidden />
      )}
    </div>
  );
}
