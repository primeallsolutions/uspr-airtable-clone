"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMetaIntegration } from "@/lib/hooks/useMetaIntegration";
import { Facebook, Instagram, Link as LinkIcon, Loader2 } from "lucide-react";

const marketingTabs = [
  { label: "Social Planner", value: "social-planner" },
  { label: "Emails", value: "emails" },
  { label: "Snippets", value: "snippets" },
  { label: "Countdown Timers", value: "countdown-timers" },
  { label: "Trigger Links", value: "trigger-links" },
  { label: "Affiliate Manager", value: "affiliate-manager" },
  { label: "Brand Boards", value: "brand-boards" },
  { label: "Ad Manager", value: "ad-manager" },
];

export const MarketingView = () => {
  const [activeTab, setActiveTab] = useState<string>(marketingTabs[0].value);
  const activeLabel =
    marketingTabs.find((tab) => tab.value === activeTab)?.label ?? marketingTabs[0].label;

  const { user } = useAuth();
  const searchParams = useSearchParams();
  const {
    isConnected,
    loading: metaLoading,
    facebookPages,
    instagramAccounts,
    connectMeta,
    disconnectMeta,
  } = useMetaIntegration(user?.id);

  // Handle OAuth callback messages
  useEffect(() => {
    if (!searchParams) return;

    const metaConnected = searchParams.get("meta_connected");
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (metaConnected === "true") {
      toast.success("Successfully connected to Facebook and Instagram!");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        meta_oauth_denied: "Authorization cancelled. Please try again.",
        meta_oauth_invalid_params: "Invalid OAuth parameters. Please try again.",
        meta_oauth_invalid_state: "Invalid OAuth state. Please try again.",
        meta_oauth_callback_error: message || "OAuth callback error. Please try again.",
      };
      toast.error(errorMessages[error] || "Failed to connect Meta account");
    }
  }, [searchParams]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your social media accounts and marketing campaigns.
        </p>
      </div>

      {/* Meta Connection Section */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Social Media Accounts</h2>
            <p className="mt-1 text-sm text-gray-600">
              Connect your Facebook and Instagram accounts to manage posts and ads.
            </p>
          </div>
          {metaLoading && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          )}
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="mb-4 flex gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Facebook className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                <Instagram className="h-8 w-8 text-white" />
              </div>
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              Connect Facebook & Instagram
            </h3>
            <p className="mb-6 max-w-md text-center text-sm text-gray-600">
              Connect your Facebook and Instagram accounts to schedule posts, manage ads, and
              view analytics all in one place.
            </p>
            <button
              onClick={connectMeta}
              disabled={metaLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LinkIcon size={18} />
              Connect with Facebook
            </button>
          </div>
        ) : (
          <div>
            {/* Connected Accounts Display */}
            <div className="space-y-4">
              {/* Facebook Pages */}
              {facebookPages.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Facebook size={16} className="text-blue-600" />
                    Facebook Pages ({facebookPages.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {facebookPages.map((page) => (
                      <div
                        key={page.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        {page.profile_picture_url ? (
                          <Image
                            src={page.profile_picture_url}
                            alt={page.account_name}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                            <Facebook size={20} className="text-blue-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {page.account_name}
                          </p>
                          {page.follower_count !== undefined && (
                            <p className="text-sm text-gray-600">
                              {page.follower_count.toLocaleString()} followers
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instagram Accounts */}
              {instagramAccounts.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Instagram size={16} className="text-pink-600" />
                    Instagram Accounts ({instagramAccounts.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {instagramAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        {account.profile_picture_url ? (
                          <Image
                            src={account.profile_picture_url}
                            alt={account.account_name}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                            <Instagram size={20} className="text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {account.account_name}
                          </p>
                          {account.account_username && (
                            <p className="truncate text-sm text-gray-600">
                              @{account.account_username}
                            </p>
                          )}
                          {account.follower_count !== undefined && (
                            <p className="text-sm text-gray-600">
                              {account.follower_count.toLocaleString()} followers
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No accounts connected yet */}
              {facebookPages.length === 0 && instagramAccounts.length === 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                  <p className="text-sm text-gray-600">
                    No Facebook Pages or Instagram accounts found. Make sure you have:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    <li>• A Facebook Page you manage</li>
                    <li>• An Instagram Business or Creator account</li>
                    <li>• The Instagram account linked to your Facebook Page</li>
                  </ul>
                </div>
              )}

              {/* Disconnect Button */}
              <div className="flex justify-end border-t border-gray-200 pt-4">
                <button
                  onClick={disconnectMeta}
                  disabled={metaLoading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Disconnect Meta Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Marketing Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {marketingTabs.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "border border-blue-200 bg-blue-50 text-blue-700 shadow-[inset_0_-2px_0_0_rgba(59,130,246,0.25)]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
        {activeLabel} will live here. We&apos;ll add functionality and layouts next.
      </div>
    </div>
  );
};
