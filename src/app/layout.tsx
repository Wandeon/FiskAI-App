import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "FiskAI",
  description: "AI-powered e-invoicing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr">
      <body>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            className: "font-sans",
            duration: 4000,
          }}
        />
        {children}
      </body>
    </html>
  );
}
