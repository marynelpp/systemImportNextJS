import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexo Import | De origen a destino",
    template: "%s | Nexo Import",
  },
  description: "Compras, inventario y ventas conectados de China a Venezuela.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
