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

const navItems = [
  { href: '/imports', label: 'Imports' },
  { href: '/catalog', label: 'Catalogue' },
  { href: '/artists', label: 'Artistes' },
  { href: '/royalties', label: 'Royalties' },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
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
      <NavbarMenu className="pt-6 pb-6 bg-background/95 backdrop-blur-md">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <NavbarMenuItem key={item.href}>
              <Link
                href={item.href}
                className={`w-full text-lg block py-4 px-2 rounded-lg transition-colors ${
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
              className="w-full text-lg block py-4 px-2 text-foreground hover:bg-default-100 rounded-lg transition-colors"
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
                  className="w-full text-lg block py-4 px-2 text-danger text-left hover:bg-danger/10 rounded-lg transition-colors"
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
