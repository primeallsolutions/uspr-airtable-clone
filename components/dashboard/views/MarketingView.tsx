import { useState } from "react";

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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
        <p className="mt-1 text-sm text-gray-600">
          Quick access to marketing tools. Content for each section is coming soon.
        </p>
      </div>

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
