'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Discover' },
    { href: '/communities', label: 'Communities' },
    { href: '/circles', label: 'Your circles' },
  ];

  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold text-[var(--foreground)]">
            Small World
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--tile)] text-[var(--foreground)]'
                      : 'text-[var(--secondary-text)] hover:bg-[var(--tile)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
