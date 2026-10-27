"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/app/actions/auth";

type NavigationItem = {
  href: string;
  label: string;
};

export default function MobileNavigation({
  items,
}: {
  items: NavigationItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mobile-menu">
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label="Abrir menú de navegación"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {isOpen && (
        <div className="mobile-menu-overlay" role="presentation">
          <button
            type="button"
            className="mobile-menu-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setIsOpen(false)}
          />
          <section className="mobile-menu-drawer" aria-label="Navegación">
            <div className="mobile-menu-heading">
              <span>MENÚ</span>
              <button
                type="button"
                className="mobile-menu-close"
                aria-label="Cerrar menú"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
            <nav>
              {items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action={logout}>
              <button className="button small">Cerrar sesión</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
