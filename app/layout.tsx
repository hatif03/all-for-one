import type { Metadata } from "next";
import { ThemeProvider } from 'next-themes';
import { Geist, Geist_Mono, Pangolin  } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';

const pangolin = Pangolin({
  subsets: ["latin"],
  variable: "--font-pangolin",
  display: "swap",
  weight: "400",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One for All – AI-Powered Business Workflow Generator",
  description:
    "Turn natural language into production-ready workflows. Describe what you need in plain English, get executable workflows with email, Slack, approvals, and more. No code required. Create with AI or build from scratch. Runs in browser, your data stays private.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${pangolin.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
