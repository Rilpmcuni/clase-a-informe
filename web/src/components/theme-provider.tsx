"use client";

import { ThemeProvider as ProveedorTema } from "next-themes";
import type { ReactNode } from "react";

export function ProveedorDeTema({ children }: { children: ReactNode }) {
  return (
    <ProveedorTema
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ProveedorTema>
  );
}
