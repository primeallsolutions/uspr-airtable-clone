"use client";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

// Hooks
import { useAuth } from "@/lib/hooks/useAuth";

// Components
import { TopBar } from "@/components/dashboard/TopBar";
import { TutorialsView } from "@/components/dashboard/views/TutorialsView";

function TutorialsContent() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleOpenAccount = () => {
    router.push("/dashboard?view=account");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={user} onSignOut={signOut} onOpenAccount={handleOpenAccount} />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <TutorialsView />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function TutorialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <TutorialsContent />
    </Suspense>
  );
}
