'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/imports', label: 'Imports' },
  { href: '/catalog', label: 'Catalogue' },
  { href: '/artists', label: 'Artistes' },
  { href: '/royalties', label: 'Royalties' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-neutral-200">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
