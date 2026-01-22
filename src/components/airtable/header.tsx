"use client";

import { useState } from "react";

import { Icon } from "~/components/ui/icon";

type HeaderProps = {
  baseName: string;
  baseColor?: string | null;
  baseIcon?: string | null;
  onBaseSettingsClick?: () => void;
  backgroundColor?: string;
};

export function Header({ baseName, baseColor, baseIcon, onBaseSettingsClick, backgroundColor }: HeaderProps) {
  const [activeTab, setActiveTab] = useState<"data" | "automations" | "interfaces" | "forms">("data");

  const tabs = [
    { id: "data" as const, label: "Data" },
    { id: "automations" as const, label: "Automations" },
    { id: "interfaces" as const, label: "Interfaces" },
    { id: "forms" as const, label: "Forms" },
  ];

  return (
    <header
      className="relative flex items-center px-4"
      style={{
        height: "var(--header-height)",
        minHeight: "var(--header-height)",
        backgroundColor: backgroundColor ?? "var(--color-background-default)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      {/* Left Section: Base Icon + Base Name (no separate logo - it's in the rail) */}
      <div className="flex items-center gap-3 z-10">
        {/* Base Name Dropdown with large green icon */}
        <button
          type="button"
          onClick={onBaseSettingsClick}
          className="flex items-center gap-2.5 rounded px-2 py-1 text-[15px] font-medium transition-colors"
          style={{ color: "var(--color-foreground-default)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {/* Large green base icon with white Airtable-style icon */}
          <span
            className="flex items-center justify-center rounded-md"
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: baseColor ?? "var(--palette-green)",
              color: "white",
            }}
          >
            <Icon name="Airtable" size={18} />
          </span>
          <span>{baseName || "Untitled Base"}</span>
          <Icon name="ChevronDownSmall" size={14} className="opacity-60" />
        </button>
      </div>

      {/* Center Section: Navigation Tabs - Absolutely centered */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="relative px-3 py-2 text-[13px] font-medium transition-colors"
            style={{
              color: activeTab === tab.id
                ? "var(--color-foreground-default)"
                : "var(--color-foreground-subtle)",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = "var(--color-foreground-default)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = "var(--color-foreground-subtle)";
              }
            }}
          >
            {tab.label}
            {/* Active indicator */}
            {activeTab === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: "var(--palette-teal-dusty)" }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-2 ml-auto z-10">
        {/* History Button */}
        <button
          type="button"
          className="flex items-center justify-center rounded p-2 transition-colors"
          style={{ color: "var(--color-foreground-subtle)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          aria-label="Base history"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 100 10A5 5 0 008 3zM2 8a6 6 0 1112 0A6 6 0 012 8zm6.5-3v3.25l2.5 1.5-.5.86L7 9V5h1.5z" />
          </svg>
        </button>

        {/* Trial Badge */}
        <button
          type="button"
          className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
          style={{
            backgroundColor: "var(--palette-neutral-lightGray2)",
            color: "var(--color-foreground-default)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-neutral-lightGray1)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-neutral-lightGray2)")}
        >
          Trial: 14 days left
        </button>

        {/* Launch Button */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors"
          style={{
            border: "1px solid var(--color-border-default)",
            color: "var(--color-foreground-default)",
            backgroundColor: "var(--color-background-default)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-background-default)")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3v10h4V3H2zm5 0v4h7V3H7zm7 5H7v5h7V8z" />
          </svg>
          <span>Launch</span>
        </button>

        {/* Share Button (Primary - Teal) */}
        <button
          type="button"
          className="rounded px-4 py-1.5 text-[13px] font-semibold text-white transition-colors"
          style={{
            backgroundColor: "var(--palette-teal-dusty)",
            boxShadow: "var(--elevation-low)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-teal-dark1)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-teal-dusty)")}
        >
          Share
        </button>
      </div>
    </header>
  );
}
