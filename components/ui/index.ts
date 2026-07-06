/**
 * Offshelf UI primitives (DESIGN §3) — the shared component contract every
 * Stage 2+ screen imports. All styling is token-only (see styles/components.css);
 * components are accessible and cover default/hover/active/focus/disabled/loading.
 */
export { cx } from "./cx";
export { Icon, ICON_NAMES, type IconName, type IconProps } from "./icon";

// Actions
export { Button, Spinner, type ButtonProps, type ButtonVariant, type ButtonSize } from "./button";
export { IconButton, type IconButtonProps } from "./icon-button";

// Forms
export { Field, type FieldProps, type FieldA11yProps } from "./field";
export {
  Input,
  Textarea,
  Select,
  PriceInput,
  HandleInput,
  slugify,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
  type PriceInputProps,
  type HandleInputProps,
} from "./input";
export { RichTextInput, type RichTextInputProps } from "./rich-text-input";
export { ImageDropzone, type ImageDropzoneProps } from "./image-dropzone";
export { Switch, type SwitchProps } from "./switch";
export { Stepper, type StepperProps } from "./stepper";

// Layout & display
export { Card, type CardProps } from "./card";
export { PageHeader, type PageHeaderProps } from "./page-header";
export { Eyebrow, Divider } from "./misc";
export { Avatar, type AvatarProps } from "./avatar";
export { Thumb, type ThumbProps } from "./thumb";
export { Skeleton, SkeletonRows, type SkeletonProps } from "./skeleton";
export {
  Pill,
  PAYMENT_TONE,
  FULFILLMENT_TONE,
  STATUS_TONE,
  INVENTORY_TONE,
  type PillTone,
  type PillProps,
} from "./badge";
export { Tabs, ViewTabs, type TabItem, type TabsProps } from "./tabs";

// Data
export { DataTable, type Column, type DataTableProps } from "./data-table";

// Overlays
export {
  Dropdown,
  MenuItem,
  MenuSeparator,
  MenuLabel,
  type DropdownProps,
  type MenuItemProps,
} from "./menu";
export { Tooltip } from "./tooltip";
export { Overlay, type OverlayProps } from "./overlay";
export { Modal, type ModalProps } from "./modal";
export { ConfirmProvider, useConfirm, type ConfirmOptions } from "./confirm";
export { useUnsavedChanges } from "./use-unsaved-changes";
export { Sheet, type SheetProps } from "./sheet";
export { CartSheet, type CartSheetProps, type CartLine } from "./cart-sheet";

// Feedback & states
export { ToastProvider, useToast } from "./toast";
export {
  EmptyState,
  ErrorState,
  NoResultsState,
  type EmptyStateProps,
  type ErrorStateProps,
} from "./states";

// Command palette
export {
  CommandPalette,
  CommandPaletteProvider,
  useCommandPalette,
  type Command,
  type CommandPaletteProps,
} from "./command-palette";
