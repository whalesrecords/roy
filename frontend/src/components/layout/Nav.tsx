'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
} from '@heroui/react';
import { useState } from 'react';

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
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          className="sm:hidden"
        />
        <NavbarBrand>
          <p className="font-bold text-inherit text-lg">Royalties</p>
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

      <NavbarContent justify="end">
        {user && (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                isBordered
                as="button"
                className="transition-transform"
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
      </NavbarContent>

      {/* Mobile menu */}
      <NavbarMenu>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <NavbarMenuItem key={item.href}>
              <Link
                href={item.href}
                className={`w-full text-lg ${
                  isActive ? 'text-primary font-semibold' : 'text-default-600'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          );
        })}
      </NavbarMenu>
    </Navbar>
  );
}
