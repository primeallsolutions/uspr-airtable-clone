"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { SupabaseUser } from "@/lib/types/dashboard";
import { ProfileService, type Profile } from "@/lib/services/profile-service";

interface TopBarProps {
  user: SupabaseUser | null;
  onSearch?: (query: string) => void;
  onSignOut: () => void;
  onOpenAccount?: () => void;
}

export const TopBar = ({ user, onSearch, onSignOut, onOpenAccount }: TopBarProps) => {
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
    <div className="flex items-center justify-between border-b bg-white px-4 py-3">
      <div className={`flex w-full max-w-xl items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-gray-600 ${onSearch ? '' : 'pointer-events-none invisible'}`}>
        <Search size={16} />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          onChange={(e) => onSearch?.(e.target.value)}
          placeholder="Search..."
        />
      </div>
      <div className="hidden items-center gap-4 md:flex">
        <Link href="/tutorials" className="rounded-full bg-gray-200 px-3 py-1 text-sm text-gray-700">Help</Link>
        <button onClick={onOpenAccount} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-sm font-medium text-gray-700 cursor-pointer overflow-hidden" title="Profile" aria-label="Open profile">
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
