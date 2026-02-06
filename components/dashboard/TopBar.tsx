"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { SupabaseUser } from "@/lib/types/dashboard";
import { ProfileService, type Profile } from "@/lib/services/profile-service";

interface TopBarProps {
  user: SupabaseUser | null;
  onSignOut: () => void;
  onOpenAccount?: () => void;
}

export const TopBar = ({ user, onSignOut, onOpenAccount }: TopBarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [activeHelpTab, setActiveHelpTab] = useState<"tutorials" | "chatbot">("tutorials");
  const helpRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!helpRef.current || helpRef.current.contains(event.target as Node)) return;
      setIsHelpOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHelpOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Replace videoId values with the YouTube IDs for your real tutorials.
  const tutorialCategories = [
    {
      id: "getting-started",
      title: "Getting started",
      videos: [
        { title: "Workspaces overview", videoId: "VIDEO_ID_1" },
        { title: "Create your first base", videoId: "VIDEO_ID_2" },
      ],
    },
    {
      id: "collaboration",
      title: "Collaboration",
      videos: [
        { title: "Invite and manage teammates", videoId: "VIDEO_ID_3" },
        { title: "Comments and activity", videoId: "VIDEO_ID_4" },
      ],
    },
    {
      id: "views",
      title: "Views & filtering",
      videos: [
        { title: "Views and filtering basics", videoId: "VIDEO_ID_5" },
        { title: "Grouping and sorting", videoId: "VIDEO_ID_6" },
      ],
    },
    {
      id: "automations",
      title: "Automations",
      videos: [
        { title: "Automations overview", videoId: "VIDEO_ID_7" },
        { title: "Schedule and triggers", videoId: "VIDEO_ID_8" },
      ],
    },
    {
      id: "integrations",
      title: "Integrations",
      videos: [
        { title: "Connect external apps", videoId: "VIDEO_ID_9" },
        { title: "Webhooks basics", videoId: "VIDEO_ID_10" },
      ],
    },
    {
      id: "data-modeling",
      title: "Data modeling",
      videos: [
        { title: "Designing tables & fields", videoId: "VIDEO_ID_11" },
        { title: "Linked records explained", videoId: "VIDEO_ID_12" },
      ],
    },
  ];

  const toggleCategory = (id: string) => {
    setOpenCategory((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-3">
      <div className="flex w-full max-w-xl items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-gray-600">
        <Search size={16} />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          placeholder="Search..."
        />
      </div>
      <div className="hidden items-center gap-4 md:flex">
        <div className="relative" ref={helpRef}>
          <button
            onClick={() => setIsHelpOpen((open) => !open)}
            className="rounded-full bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300 transition-colors"
            aria-haspopup="true"
            aria-expanded={isHelpOpen}
          >
            Help
          </button>
          {isHelpOpen && (
            <div className="absolute right-0 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-xl z-20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Help</p>
                  <p className="text-xs text-gray-500">Pick what you need.</p>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                  aria-label="Close help dropdown"
                >
                  Close
                </button>
              </div>
              <div className="flex border-b border-gray-100 px-4">
                <button
                  onClick={() => {
                    setActiveHelpTab("tutorials");
                    setOpenCategory(null);
                  }}
                  className={`flex-1 px-3 py-2 text-sm font-semibold ${
                    activeHelpTab === "tutorials"
                      ? "text-blue-700 border-b-2 border-blue-700"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Tutorials
                </button>
                <button
                  onClick={() => {
                    setActiveHelpTab("chatbot");
                    setOpenCategory(null);
                  }}
                  className={`flex-1 px-3 py-2 text-sm font-semibold ${
                    activeHelpTab === "chatbot"
                      ? "text-blue-700 border-b-2 border-blue-700"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Chatbot
                </button>
              </div>
              {activeHelpTab === "tutorials" ? (
                <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
                  {tutorialCategories.map((category) => (
                    <div key={category.id} className="rounded-md border border-gray-100">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        <span>{category.title}</span>
                        <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
                          {category.videos.length} videos
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${openCategory === category.id ? "rotate-180" : ""}`}
                          />
                        </span>
                      </button>
                      {openCategory === category.id && (
                        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                          {category.videos.map((video) => (
                            <div key={video.videoId} className="space-y-2">
                              <p className="text-sm font-medium text-gray-800">{video.title}</p>
                              <div className="relative overflow-hidden rounded-md border border-gray-200 bg-black/5">
                                <div className="aspect-video">
                                  <iframe
                                    src={`https://www.youtube.com/embed/${video.videoId}`}
                                    title={video.title}
                                    className="h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-900">Chatbot</p>
                    <p className="text-xs text-gray-600">Ask quick questions — live chat coming soon.</p>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">CB</div>
                        <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm w-4/5">
                          Hi! I&apos;m your workspace assistant. Chat is coming soon - stay tuned!
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <div className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-sm w-4/5 text-right">
                          Great, looking forward to it!
                        </div>
                        <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">You</div>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        disabled
                        placeholder="Message the chatbot (coming soon)"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400">Coming soon</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
