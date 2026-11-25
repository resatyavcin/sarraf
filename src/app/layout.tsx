import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";
const font = localFont({
  src: "../../public/fonts/plus-jakarta-sans.ttf",
  variable: "--font-jakarta",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Sarraf",
  description: "Kişisel bütçe yönetimi",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={font.variable}>
      <body>
        <ThemeProvider defaultTheme="light" storageKey="sarraf-theme">
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
