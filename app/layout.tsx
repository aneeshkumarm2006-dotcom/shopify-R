import type { Metadata } from "next";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import { fontDisplay, fontMono, fontUi } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Offshelf",
    template: "%s · Offshelf",
  },
  description:
    "The store platform for businesses everyone else bans — build, manage, and publish a storefront for high-risk verticals.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontUi.variable} ${fontMono.variable} ${fontDisplay.variable}`}
    >
      <head>
        {/* No-flash theme: set data-theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NavigationProgress />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
