import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Thumb (DESIGN §2.6) — image with a neutral `--surface-sunken` + icon fallback,
 * so a missing merchant image never looks broken. Reserve aspect ratio to avoid
 * layout shift: pass `ratio` (e.g. "4 / 5") or a square `size`.
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
    ? { width: size, aspectRatio: ratio, borderRadius: radius }
    : { width: size, height: size, borderRadius: radius };
  return (
    <div className="thumb" style={style}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
      ) : (
        <Icon name={icon} size={Math.min(size * 0.4, 28)} aria-hidden />
      )}
    </div>
  );
}
