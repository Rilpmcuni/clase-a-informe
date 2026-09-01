"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LayoutDashboard, Upload, Settings2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const enlaces = [
  { href: "/", etiqueta: "Clases", icono: LayoutDashboard },
  { href: "/nueva", etiqueta: "Nueva", icono: Upload },
  { href: "/memoria", etiqueta: "Memoria", icono: Brain },
  { href: "/ajustes", etiqueta: "Ajustes", icono: Settings2 },
];

export function Cabecera() {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Clase <span className="text-primary">a</span> Informe
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {enlaces.map(({ href, etiqueta, icono: Icono }) => {
            const activo = href === "/" ? ruta === "/" : ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activo
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icono className="h-4 w-4" />
                <span className="hidden sm:inline">{etiqueta}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
