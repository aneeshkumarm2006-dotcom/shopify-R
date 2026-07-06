import Image from "next/image";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Thumb (DESIGN §2.6) — image with a neutral `--surface-sunken` + icon fallback,
 * so a missing merchant image never looks broken. Reserve aspect ratio to avoid
 * layout shift: pass `ratio` (e.g. "4 / 5") or a square `size`.
 *
 * Uses `next/image` (Cloudinary allowlisted) so admin thumbnails are lazy-loaded and
 * served at thumbnail resolution instead of shipping full-size originals into tables.
 */
export interface ThumbProps {
  src?: string | null;
  alt?: string;
  size?: number;
  /** CSS aspect-ratio string, e.g. "4 / 5". When set, height comes from the ratio. */
  ratio?: string;
  radius?: string;
  icon?: IconName;
}

export function Thumb({
  src,
  alt = "",
  size = 36,
  ratio,
  radius = "var(--radius-sm)",
  icon = "imageOff",
}: ThumbProps) {
  const style = ratio
    ? { width: size, aspectRatio: ratio, borderRadius: radius, position: "relative" as const }
    : { width: size, height: size, borderRadius: radius, position: "relative" as const };
  return (
    <div className="thumb" style={style}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
      ) : (
        <Icon name={icon} size={Math.min(size * 0.4, 28)} aria-hidden />
      )}
    </div>
  );
}
