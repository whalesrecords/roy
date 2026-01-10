'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
} from '@heroui/react';
import { useState, useEffect } from 'react';
import { getLabelSettings, LabelSettings } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

const navItems = [
  { href: '/artists', label: 'Artistes' },
  { href: '/imports', label: 'Imports' },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);

  useEffect(() => {
    getLabelSettings().then(setLabelSettings).catch(() => {});
  }, []);

  return (
    <Navbar
      maxWidth="xl"
      isBordered
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      classNames={{
        base: "bg-background",
        wrapper: "px-4",
      }}
    >
      <NavbarContent justify="start">
        <NavbarBrand>
          <Link href="/" className="flex items-center gap-1">
            {labelSettings?.logo_base64 ? (
              <img
                src={labelSettings.logo_base64}
                alt="W"
                className="h-6 w-6 object-contain"
              />
            ) : (
              <span className="font-bold text-lg">W</span>
            )}
            <span className="font-bold text-inherit text-lg">.Royalties</span>
          </Link>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-6" justify="center">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <NavbarItem key={item.href} isActive={isActive}>
              <Link
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-default-600 hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>

      <NavbarContent justify="end" className="gap-2">
        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl hover:bg-default-100 transition-colors"
          aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5 text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {user && (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                isBordered
                as="button"
                className="transition-transform hidden sm:flex"
                color="primary"
                name={user.email?.charAt(0).toUpperCase()}
                size="sm"
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Actions profil" variant="flat">
              <DropdownItem key="profile" className="h-14 gap-2" textValue="Profil">
                <p className="font-semibold">Connecté</p>
                <p className="text-sm text-default-500">{user.email}</p>
              </DropdownItem>
              <DropdownItem key="settings" href="/settings">
                Paramètres
              </DropdownItem>
              <DropdownItem key="logout" color="danger" onPress={() => signOut()}>
                Déconnexion
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
        {/* Hamburger menu for mobile */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="sm:hidden p-2 rounded-lg hover:bg-default-100 transition-colors"
          aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          <svg className="w-6 h-6 text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </NavbarContent>

      {/* Mobile menu */}
      <NavbarMenu className="pt-6 pb-6 bg-background border-t border-divider">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <NavbarMenuItem key={item.href}>
              <Link
                href={item.href}
                className={`w-full text-lg block py-4 px-2 rounded-xl transition-colors ${
                  isActive
                    ? 'text-primary font-semibold bg-primary/10'
                    : 'text-foreground hover:bg-default-100'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          );
        })}
        <div className="border-t border-divider mt-4 pt-4">
          <NavbarMenuItem>
            <Link
              href="/settings"
              className="w-full text-lg block py-4 px-2 text-foreground hover:bg-default-100 rounded-xl transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Paramètres
            </Link>
          </NavbarMenuItem>
          {user && (
            <>
              <NavbarMenuItem>
                <div className="px-2 py-2 text-sm text-default-500">
                  {user.email}
                </div>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <button
                  onClick={() => {
                    signOut();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-lg block py-4 px-2 text-danger text-left hover:bg-danger/10 rounded-xl transition-colors"
                >
                  Déconnexion
                </button>
              </NavbarMenuItem>
            </>
          )}
        </div>
      </NavbarMenu>
    </Navbar>
  );
}
