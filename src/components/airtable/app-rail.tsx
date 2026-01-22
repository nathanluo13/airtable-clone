"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "~/components/ui/icon";

type AppRailProps = {
  userName: string;
  userEmail: string;
  onHomeClick: () => void;
};

export function AppRail({ userName, userEmail, onHomeClick }: AppRailProps) {
  const router = useRouter();
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

  return (
    <aside
      className="flex flex-col items-center py-2"
      style={{
        width: "44px",
        minWidth: "44px",
        backgroundColor: "var(--color-background-default)",
        borderRight: "1px solid var(--color-border-default)",
      }}
    >
      {/* Top section */}
      <div className="flex flex-col items-center gap-1">
        {/* Home button - uses existing Airtable icon */}
        <button
          type="button"
          onClick={onHomeClick}
          className="flex items-center justify-center rounded p-2 transition-colors"
          style={{ color: "var(--color-foreground-default)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="Home"
        >
          <Icon name="Airtable" size={20} />
        </button>

        {/* AI Cobuilder sparkle icon */}
        <button
          type="button"
          className="flex items-center justify-center rounded p-2 transition-colors"
          style={{ color: "var(--color-foreground-subtle)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="AI Cobuilder"
        >
          {/* Dotted circle with sparkles - Airtable's AI icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle
              cx="10"
              cy="10"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              fill="none"
            />
            <circle cx="10" cy="5" r="1" fill="currentColor" />
            <circle cx="10" cy="15" r="1" fill="currentColor" />
            <circle cx="5" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-1">
        {/* Help */}
        <button
          type="button"
          className="flex items-center justify-center rounded p-2 transition-colors"
          style={{ color: "var(--color-foreground-subtle)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="Help"
        >
          <Icon name="Question" size={18} />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="flex items-center justify-center rounded p-2 transition-colors"
          style={{ color: "var(--color-foreground-subtle)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="Notifications"
        >
          <Icon name="Bell" size={18} />
        </button>

        {/* Profile avatar with dropdown menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center justify-center rounded-full transition-opacity"
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
            {userName?.trim()?.charAt(0)?.toUpperCase() || "U"}
          </button>

          {/* User Dropdown Menu - fixed position to escape overflow */}
          {userMenuOpen && (
            <div
              className="fixed w-64 rounded-lg py-2"
              style={{
                bottom: "60px",
                left: "52px",
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
    </aside>
  );
}
