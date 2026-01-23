"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MembershipService } from "@/lib/services/membership-service";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params?.token) ? params?.token[0] : params?.token;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Accepting invite...");

  useEffect(() => {
    async function accept() {
      try {
        // Handle magic-link exchange to ensure session exists after email redirect
        const code = searchParams?.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus("error");
          setMessage("You must be signed in to accept an invite.");
          return;
        }
        const result = await MembershipService.acceptInvite(String(token), user.id, user.email);
        setStatus("success");
        const next = result?.redirectPath ?? "/dashboard";
        setMessage("Invite accepted. Redirecting...");
        setTimeout(() => router.replace(next), 800);
      } catch (e: unknown) {
        console.error('Accept invite failed', e);
        setStatus("error");
        if (e instanceof Error) {
          setMessage(e.message);
        } else if (typeof e === 'object' && e !== null && 'message' in e) {
          setMessage(String((e as { message: unknown }).message));
        } else {
          setMessage("Failed to accept invite.");
        }
      }
    }
    if (token) void accept();
  }, [token, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md text-center">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Accept Invite</h1>
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-gray-700'}`}>{message}</p>
      </div>
    </div>
  );
}


