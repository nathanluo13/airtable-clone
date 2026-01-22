"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type HeaderProps = {
  baseName: string;
  onBaseSettingsClick?: () => void;
  userName: string;
  userEmail: string;
};

export function Header({ baseName, onBaseSettingsClick, userName, userEmail }: HeaderProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"data" | "automations" | "interfaces" | "forms">("data");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const tabs = [
    { id: "data" as const, label: "Data" },
    { id: "automations" as const, label: "Automations" },
    { id: "interfaces" as const, label: "Interfaces" },
    { id: "forms" as const, label: "Forms" },
  ];

  return (
    <header
      className="flex items-center justify-between px-4"
      style={{
        height: "var(--header-height)",
        minHeight: "var(--header-height)",
        backgroundColor: "var(--color-background-default)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      {/* Left Section: Logo + Base Name */}
      <div className="flex items-center gap-3">
        {/* Airtable Logo - Official 3D prism design */}
        <a href="/" className="flex items-center" aria-label="Back to home">
          <svg
            width="24"
            height="20"
            viewBox="0 0 24 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Yellow top face */}
            <path
              d="M10.5 0.3L1.2 4.4C0.8 4.5 0.8 5 1.2 5.2L10.5 9.2C11.5 9.6 12.5 9.6 13.5 9.2L22.8 5.2C23.2 5 23.2 4.5 22.8 4.4L13.5 0.3C12.5 -0.1 11.5 -0.1 10.5 0.3Z"
              fill="#FCB400"
            />
            {/* Blue left face */}
            <path
              d="M11 11.4V19.3C11 19.7 11.4 20 11.8 19.8L22.4 15.6C22.7 15.5 22.9 15.2 22.9 14.9V7C22.9 6.6 22.5 6.3 22.1 6.5L11.5 10.7C11.2 10.8 11 11.1 11 11.4Z"
              fill="#18BFFF"
            />
            {/* Red right face */}
            <path
              d="M9.5 11.2L2.1 7.9C1.6 7.6 1 8 1 8.6V14.9C1 15.2 1.2 15.5 1.5 15.6L9.1 18.9C9.6 19.1 10.1 18.8 10.1 18.2V11.8C10.1 11.5 9.9 11.3 9.5 11.2Z"
              fill="#F82B60"
            />
          </svg>
        </a>

        {/* Base Name Dropdown */}
        <button
          type="button"
          onClick={onBaseSettingsClick}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[15px] font-medium transition-colors"
          style={{ color: "var(--color-foreground-default)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <span>{baseName || "Untitled Base"}</span>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M4 6l4 4 4-4H4z" />
          </svg>
        </button>
      </div>

      {/* Center Section: Navigation Tabs */}
      <nav className="flex items-center gap-1">
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
      <div className="flex items-center gap-2">
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
            backgroundColor: "var(--color-background-notice)",
            color: "var(--palette-yellow-dark1)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
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

        {/* User Avatar & Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: "28px",
              height: "28px",
              backgroundColor: "var(--palette-green)",
              color: "white",
              fontSize: "12px",
              fontWeight: 500,
            }}
            aria-label="Account"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {userName.charAt(0).toUpperCase()}
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-lg py-2"
              style={{
                backgroundColor: "var(--color-background-default)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                border: "1px solid var(--color-border-default)",
                zIndex: 50,
              }}
            >
              {/* User Info */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-default)" }}>
                <div className="text-[14px] font-medium" style={{ color: "var(--color-foreground-default)" }}>
                  {userName}
                </div>
                <div className="text-[13px]" style={{ color: "var(--color-foreground-subtle)" }}>
                  {userEmail}
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors"
                  style={{ color: "var(--color-foreground-default)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  Account
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors"
                  style={{ color: "var(--color-foreground-default)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 10a2 2 0 100-4 2 2 0 000 4zm6-2c0-.3 0-.6-.1-.9l1.6-1.2-1.5-2.6-1.9.5c-.4-.4-.9-.7-1.4-.9L10 1H6l-.7 1.9c-.5.2-1 .5-1.4.9l-1.9-.5-1.5 2.6 1.6 1.2c-.1.3-.1.6-.1.9s0 .6.1.9L.5 10.1l1.5 2.6 1.9-.5c.4.4.9.7 1.4.9L6 15h4l.7-1.9c.5-.2 1-.5 1.4-.9l1.9.5 1.5-2.6-1.6-1.2c.1-.3.1-.6.1-.9z" />
                  </svg>
                  Notification preferences
                </button>
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid var(--color-border-default)", margin: "4px 0" }} />

              {/* Log out */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors"
                  style={{ color: "var(--color-foreground-default)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 2h7v2H4v8h5v2H2V2zm9 3l4 3-4 3V9H6V7h5V5z" />
                  </svg>
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
