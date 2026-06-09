import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bell,
  Bold,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Code,
  Command,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  Heading,
  Home,
  Image as ImageIcon,
  ImageOff,
  Info,
  Italic,
  Layers,
  Layout,
  LayoutGrid,
  Leaf,
  Link as LinkIcon,
  List,
  Lock,
  Mail,
  MapPin,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Sun,
  Tag,
  Text,
  Trash2,
  Truck,
  Type,
  Upload,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * Single icon set for the whole app (DESIGN §2.6). Screens reference icons by the
 * same semantic names the prototype used (`icons.jsx`), so usage reads identically:
 *   <Icon name="inventory" size={18} />
 * Defaults match the prototype: 18px, 1.5px stroke, rounded caps/joins (lucide default).
 */
const REGISTRY = {
  // nav
  home: Home,
  orders: ClipboardList,
  products: Package,
  inventory: LayoutGrid,
  customers: Users,
  store: Store,
  analytics: BarChart3,
  settings: Settings,
  // ui
  search: Search,
  command: Command,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronUp: ChevronUp,
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
  dots: MoreHorizontal,
  sun: Sun,
  moon: Moon,
  image: ImageIcon,
  imageOff: ImageOff,
  upload: Upload,
  cart: ShoppingCart,
  alert: AlertCircle,
  alertTri: AlertTriangle,
  eye: Eye,
  eyeOff: EyeOff,
  drag: GripVertical,
  external: ExternalLink,
  arrowRight: ArrowRight,
  arrowUpDown: ArrowUpDown,
  box: Box,
  tag: Tag,
  truck: Truck,
  user: User,
  mail: Mail,
  phone: Phone,
  mapPin: MapPin,
  // rich-text / builder
  bold: Bold,
  italic: Italic,
  link: LinkIcon,
  list: List,
  heading: Heading,
  grid: LayoutGrid,
  layout: Layout,
  type: Type,
  monitor: Monitor,
  smartphone: Smartphone,
  sliders: SlidersHorizontal,
  layers: Layers,
  text: Text,
  code: Code,
  trash: Trash2,
  copy: Copy,
  lock: Lock,
  sparkle: Sparkles,
  clock: Clock,
  filter: Filter,
  bell: Bell,
  leaf: Leaf,
  info: Info,
  refresh: RefreshCw,
  star: Star,
  download: Download,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof REGISTRY | "google";

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.5,
  className,
  style,
  ...rest
}: IconProps) {
  // Google is a brand mark (lucide dropped brand icons) — render its glyph inline.
  if (name === "google") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        style={{ flexShrink: 0, ...style }}
        aria-hidden={rest["aria-label"] ? undefined : true}
        aria-label={rest["aria-label"]}
        role={rest["aria-label"] ? "img" : undefined}
      >
        <path
          fill="#4285F4"
          d="M21 12.2c0-.6-.05-1.2-.15-1.7H12v3.4h5.05a4.3 4.3 0 0 1-1.87 2.8v2.3h3a9 9 0 0 0 2.82-6.8z"
        />
        <path
          fill="#34A853"
          d="M12 21.5c2.4 0 4.45-.8 5.93-2.2l-3-2.3c-.8.55-1.85.9-2.93.9-2.25 0-4.16-1.5-4.85-3.55h-3.1v2.35A9 9 0 0 0 12 21.5z"
        />
        <path
          fill="#FBBC05"
          d="M7.15 14.35a5.4 5.4 0 0 1 0-3.45V8.55h-3.1a9 9 0 0 0 0 8.15z"
        />
        <path
          fill="#EA4335"
          d="M12 6.55a4.9 4.9 0 0 1 3.45 1.35l2.6-2.6A8.65 8.65 0 0 0 12 2.5a9 9 0 0 0-7.95 4.9l3.1 2.4C7.84 8.05 9.75 6.55 12 6.55z"
        />
      </svg>
    );
  }

  const Glyph = REGISTRY[name];
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={rest["aria-label"] ? undefined : (rest["aria-hidden"] ?? true)}
      aria-label={rest["aria-label"]}
    />
  );
}

/** All available icon names (handy for the kitchen-sink demo in Stage 1). */
export const ICON_NAMES = [...Object.keys(REGISTRY), "google"] as IconName[];
