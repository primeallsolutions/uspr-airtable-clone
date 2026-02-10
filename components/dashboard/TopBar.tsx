"use client";
import { useEffect, useState } from "react";
import { Search, Menu, X } from "lucide-react";
import type { SupabaseUser } from "@/lib/types/dashboard";
import { ProfileService, type Profile } from "@/lib/services/profile-service";

interface TopBarProps {
  user: SupabaseUser | null;
  onSignOut: () => void;
  onOpenAccount?: () => void;
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export const TopBar = ({ user, onSignOut, onOpenAccount, onMenuToggle, isMobileMenuOpen, searchQuery, setSearchQuery }: TopBarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await ProfileService.getMyProfile();
        setAvatarUrl((p as Profile | null)?.avatar_url ?? null);
      } catch {
        setAvatarUrl(null);
      }
    };
    void load();

    const handler = (e: Event) => {
      const url = (e as CustomEvent).detail?.url as string | undefined;
      if (url) setAvatarUrl(url);
    };
    window.addEventListener('app:profile-avatar-changed', handler as EventListener);
    return () => window.removeEventListener('app:profile-avatar-changed', handler as EventListener);
  }, [user?.id]);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 border-b bg-white px-3 md:px-4 py-2 md:py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex w-full sm:max-w-xl items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-gray-600 text-sm">
          <Search size={16} className="flex-shrink-0" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder="Search..."
            onChange={(e) => setSearchQuery?.(e.target.value)}
            value={searchQuery}
          />
        </div>
        <button onClick={onOpenAccount} className="flex sm:hidden h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-sm font-medium text-gray-700 cursor-pointer overflow-hidden flex-shrink-0 hover:bg-gray-400 transition-colors" title="Profile" aria-label="Open profile">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            user?.email?.charAt(0).toUpperCase()
          )}
        </button>
      </div>
      <div className="hidden sm:flex items-center gap-2 md:gap-4">
        <button className="rounded-full bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300 transition-colors">Help</button>
        <button onClick={onOpenAccount} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-sm font-medium text-gray-700 cursor-pointer overflow-hidden flex-shrink-0 hover:bg-gray-400 transition-colors" title="Profile" aria-label="Open profile">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            user?.email?.charAt(0).toUpperCase()
          )}
        </button>
        <button onClick={onSignOut} className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer">Sign out</button>
      </div>
    </div>
  );
};
