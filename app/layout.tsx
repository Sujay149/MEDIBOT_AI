import type { Metadata } from "next";
import Head from "next/head";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MEDIBOT_REM - AI Medical Assistant",
  description: "Your friendly AI medical assistant for health information, reminders, and guidance",
  themeColor: "#0f172a",
  viewport: "width=device-width, initial-scale=1.0",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  applicationName: "Medibot",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Medibot",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
      <body className={`${inter.className} bg-background text-foreground min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}