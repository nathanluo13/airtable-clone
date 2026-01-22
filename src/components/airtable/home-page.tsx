"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Base = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

type HomePageProps = {
  bases: Base[];
  onSelectBase: (baseId: string) => void;
  onCreateBase: (name: string) => void;
  isCreating: boolean;
  userName: string;
  userEmail: string;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Opened just now";
  if (diffMins < 60) return `Opened ${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `Opened ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `Opened ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// Airtable exact box-shadow
const cardBoxShadow = "rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px";

export function HomePage({ bases, onSelectBase, onCreateBase, isCreating, userName, userEmail }: HomePageProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBaseName, setNewBaseName] = useState("");
  const [activeNav, setActiveNav] = useState<"home" | "starred" | "shared">("home");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
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

  const handleCreate = () => {
    if (!newBaseName.trim()) return;
    onCreateBase(newBaseName.trim());
    setNewBaseName("");
    setShowCreateModal(false);
  };

  return (
    <div
      className="flex h-screen flex-col text-[13px]"
      style={{ backgroundColor: "#fff", color: "rgb(29, 31, 37)" }}
    >
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside
          className="flex flex-col"
          style={{
            width: "240px",
            backgroundColor: "#fff",
            borderRight: "1px solid rgb(225, 227, 230)",
          }}
        >
          {/* Header with hamburger menu and logo */}
          <div
            className="flex items-center gap-2 px-2"
            style={{ height: "46px", borderBottom: "1px solid rgb(225, 227, 230)" }}
          >
            {/* Hamburger Menu */}
            <button
              type="button"
              className="rounded p-2 transition-colors"
              style={{ color: "rgb(97, 102, 112)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3h14v1.5H1V3zm0 4.25h14v1.5H1v-1.5zm0 4.25h14V13H1v-1.5z" />
              </svg>
            </button>
            {/* Airtable Logo */}
            <div className="flex items-center gap-2">
              <svg width="24" height="20" viewBox="0 0 200 170" style={{ shapeRendering: "geometricPrecision" }}>
                <path fill="rgb(255, 186, 5)" d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
                <path fill="rgb(57, 202, 255)" d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
                <path fill="rgb(220, 4, 59)" d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6294 L11.0401,60.0864 C11.0401,58.7924 11.6871,57.5874 12.7711,56.8684 C13.3491,56.4904 14.0001,56.2994 14.6551,56.2994 C15.1811,56.2994 15.7101,56.4234 16.2011,56.6674 L87.5961,87.2344 C89.7411,88.1594 90.4641,90.6854 88.0781,91.8464" />
                <path fill="rgba(0, 0, 0, 0.25)" d="M88.0781,91.8464 L66.1741,102.4224 L17.6001,56.7734 C18.1121,56.4664 18.6971,56.2994 19.2951,56.2994 C19.8211,56.2994 20.3501,56.4234 20.8411,56.6674 L87.5961,87.2344 C89.7411,88.1594 90.4641,90.6854 88.0781,91.8464" />
              </svg>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "rgb(29, 31, 37)" }}>Airtable</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2">
            {/* Home */}
            <button
              type="button"
              onClick={() => setActiveNav("home")}
              className="flex w-full items-center gap-3 rounded px-3 transition-colors"
              style={{
                height: "32px",
                backgroundColor: activeNav === "home" ? "rgb(242, 244, 248)" : "transparent",
                color: "rgb(29, 31, 37)",
                borderRadius: "3px",
              }}
              onMouseEnter={(e) => {
                if (activeNav !== "home") e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)";
              }}
              onMouseLeave={(e) => {
                if (activeNav !== "home") e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.3L1.5 6.5V14.5H6V10H10V14.5H14.5V6.5L8 1.3Z" />
              </svg>
              <span style={{ fontSize: "13px" }}>Home</span>
            </button>

            {/* Starred */}
            <button
              type="button"
              onClick={() => setActiveNav("starred")}
              className="flex w-full items-center justify-between rounded px-3 transition-colors"
              style={{
                height: "32px",
                backgroundColor: activeNav === "starred" ? "rgb(242, 244, 248)" : "transparent",
                color: "rgb(29, 31, 37)",
                borderRadius: "3px",
              }}
              onMouseEnter={(e) => {
                if (activeNav !== "starred") e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)";
              }}
              onMouseLeave={(e) => {
                if (activeNav !== "starred") e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1.5l2 4 4.5.7-3.3 3.2.8 4.5L8 11.6l-4 2.3.8-4.5-3.3-3.2 4.5-.7 2-4z" />
                </svg>
                <span style={{ fontSize: "13px" }}>Starred</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {/* Starred description */}
            <div className="px-3 py-2">
              <p style={{ fontSize: "12px", color: "rgb(97, 102, 112)", lineHeight: "1.4" }}>
                Your starred bases, interfaces, and workspaces will appear here
              </p>
            </div>

            {/* Shared */}
            <button
              type="button"
              onClick={() => setActiveNav("shared")}
              className="flex w-full items-center gap-3 rounded px-3 transition-colors"
              style={{
                height: "32px",
                backgroundColor: activeNav === "shared" ? "rgb(242, 244, 248)" : "transparent",
                color: "rgb(29, 31, 37)",
                borderRadius: "3px",
              }}
              onMouseEnter={(e) => {
                if (activeNav !== "shared") e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)";
              }}
              onMouseLeave={(e) => {
                if (activeNav !== "shared") e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 12v1a2 2 0 002 2h4a2 2 0 002-2v-1M8 1v10M5 4l3-3 3 3" />
              </svg>
              <span style={{ fontSize: "13px" }}>Shared</span>
            </button>

            {/* Workspaces */}
            <div className="mt-2">
              <div
                className="flex w-full items-center justify-between rounded px-3 transition-colors cursor-pointer"
                style={{ height: "32px", color: "rgb(29, 31, 37)", borderRadius: "3px" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div className="flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                  <span style={{ fontSize: "13px" }}>Workspaces</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded p-1 transition-colors"
                    style={{ color: "rgb(97, 102, 112)" }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(225, 227, 230)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </div>
              </div>
            </div>
          </nav>

          {/* Bottom section */}
          <div className="px-2 py-2" style={{ borderTop: "1px solid rgb(225, 227, 230)" }}>
            {/* Templates and apps */}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded px-3 transition-colors"
              style={{ height: "32px", color: "rgb(29, 31, 37)", borderRadius: "3px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
              <span style={{ fontSize: "13px" }}>Templates and apps</span>
            </button>

            {/* Marketplace */}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded px-3 transition-colors"
              style={{ height: "32px", color: "rgb(29, 31, 37)", borderRadius: "3px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="4" width="14" height="10" rx="1" />
                <path d="M1 7h14" />
              </svg>
              <span style={{ fontSize: "13px" }}>Marketplace</span>
            </button>

            {/* Import */}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded px-3 transition-colors"
              style={{ height: "32px", color: "rgb(29, 31, 37)", borderRadius: "3px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v8M5 7l3 3 3-3M2 12v2h12v-2" />
              </svg>
              <span style={{ fontSize: "13px" }}>Import</span>
            </button>
          </div>

          {/* Create button */}
          <div className="p-2">
            <button
              type="button"
              disabled={isCreating}
              onClick={() => setShowCreateModal(true)}
              className="flex w-full items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{
                height: "32px",
                borderRadius: "6px",
                backgroundColor: "rgb(22, 110, 225)",
                color: "white",
                fontSize: "13px",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(18, 92, 189)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgb(22, 110, 225)")}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Create</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto" style={{ backgroundColor: "#fff" }}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4"
            style={{ height: "46px", borderBottom: "1px solid rgb(225, 227, 230)" }}
          >
            {/* Search */}
            <div className="relative flex-1 max-w-[560px] mx-auto">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3"
                style={{
                  height: "32px",
                  backgroundColor: "rgb(242, 244, 248)",
                  color: "rgb(97, 102, 112)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="6.5" cy="6.5" r="5" />
                  <path d="M10.5 10.5L14 14" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: "13px", flex: 1, textAlign: "left" }}>Search...</span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "rgb(97, 102, 112)",
                    backgroundColor: "rgb(225, 227, 230)",
                    padding: "2px 6px",
                    borderRadius: "3px",
                  }}
                >
                  ⌘ K
                </span>
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 ml-4">
              <button
                type="button"
                className="flex items-center gap-1 rounded px-2 py-1 transition-colors"
                style={{ color: "rgb(29, 31, 37)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5v3h2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: "13px" }}>Help</span>
              </button>
              <button
                type="button"
                className="rounded p-1 transition-colors"
                style={{ color: "rgb(97, 102, 112)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5.5a4 4 0 10-8 0c0 2 1 3 1 4.5H11c0-1.5 1-2.5 1-4.5zM6 12h4M7 14h2" strokeLinecap="round" />
                </svg>
              </button>

              {/* User Avatar & Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center justify-center rounded-full text-[13px] font-medium cursor-pointer transition-opacity"
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: "rgb(32, 150, 83)",
                    color: "white",
                  }}
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
                      backgroundColor: "#fff",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                      border: "1px solid rgb(225, 227, 230)",
                      zIndex: 50,
                    }}
                  >
                    {/* User Info */}
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgb(225, 227, 230)" }}>
                      <div className="text-[14px] font-medium" style={{ color: "rgb(29, 31, 37)" }}>
                        {userName}
                      </div>
                      <div className="text-[13px]" style={{ color: "rgb(97, 102, 112)" }}>
                        {userEmail}
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors"
                        style={{ color: "rgb(29, 31, 37)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
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
                        style={{ color: "rgb(29, 31, 37)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 10a2 2 0 100-4 2 2 0 000 4zm6-2c0-.3 0-.6-.1-.9l1.6-1.2-1.5-2.6-1.9.5c-.4-.4-.9-.7-1.4-.9L10 1H6l-.7 1.9c-.5.2-1 .5-1.4.9l-1.9-.5-1.5 2.6 1.6 1.2c-.1.3-.1.6-.1.9s0 .6.1.9L.5 10.1l1.5 2.6 1.9-.5c.4.4.9.7 1.4.9L6 15h4l.7-1.9c.5-.2 1-.5 1.4-.9l1.9.5 1.5-2.6-1.6-1.2c.1-.3.1-.6.1-.9z" />
                        </svg>
                        Notification preferences
                      </button>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid rgb(225, 227, 230)", margin: "4px 0" }} />

                    {/* Log out */}
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors"
                        style={{ color: "rgb(29, 31, 37)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
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
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <h1
              style={{
                fontSize: "27px",
                fontWeight: 600,
                color: "rgb(29, 31, 37)",
                marginBottom: "24px",
              }}
            >
              Home
            </h1>

            {/* Start building section */}
            <div className="mb-8">
              <h2
                style={{
                  fontSize: "21px",
                  fontWeight: 575,
                  color: "rgb(29, 31, 37)",
                  marginBottom: "4px",
                }}
              >
                Start building
              </h2>
              <p style={{ fontSize: "13px", color: "rgb(97, 102, 112)", marginBottom: "16px" }}>
                Create apps instantly with AI
              </p>

              {/* Template cards */}
              <div className="flex gap-4">
                {[
                  { name: "OKR Manager", desc: "Align and track team objectives and key results.", icon: "target" },
                  { name: "Bug Tracker", desc: "Log, assign, and resolve bugs efficiently.", icon: "check" },
                  { name: "Project Tracker", desc: "Monitor engineering projects from planning to completion.", icon: "grid" },
                ].map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    className="flex flex-1 items-start gap-3 text-left transition-all"
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: "6px",
                      boxShadow: cardBoxShadow,
                      padding: "16px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.12) 0px 2px 6px 0px";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = cardBoxShadow;
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded"
                      style={{
                        width: "32px",
                        height: "32px",
                        backgroundColor: "rgb(242, 244, 248)",
                      }}
                    >
                      {template.icon === "target" && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgb(97, 102, 112)" strokeWidth="1.5">
                          <circle cx="8" cy="8" r="6" />
                          <circle cx="8" cy="8" r="3" />
                          <circle cx="8" cy="8" r="0.5" fill="rgb(97, 102, 112)" />
                        </svg>
                      )}
                      {template.icon === "check" && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgb(97, 102, 112)" strokeWidth="1.5">
                          <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {template.icon === "grid" && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgb(97, 102, 112)" strokeWidth="1.5">
                          <rect x="1" y="1" width="14" height="14" rx="1" />
                          <path d="M1 5h14M5 5v10" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "rgb(29, 31, 37)" }}>
                        {template.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "rgb(97, 102, 112)", marginTop: "2px" }}>
                        {template.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opened anytime section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  className="flex items-center gap-1 transition-colors"
                  style={{ color: "rgb(29, 31, 37)", fontSize: "13px" }}
                >
                  <span>Opened anytime</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {/* View toggle */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className="rounded p-1.5 transition-colors"
                    style={{
                      backgroundColor: viewMode === "list" ? "rgb(242, 244, 248)" : "transparent",
                      color: "rgb(97, 102, 112)",
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== "list") e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)";
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== "list") e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1 3h14v1.5H1V3zm0 4h14v1.5H1V7zm0 4h14v1.5H1V11z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className="rounded p-1.5 transition-colors"
                    style={{
                      backgroundColor: viewMode === "grid" ? "rgb(242, 244, 248)" : "transparent",
                      color: "rgb(97, 102, 112)",
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== "grid") e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)";
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== "grid") e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="1" width="6" height="6" rx="1" />
                      <rect x="9" y="1" width="6" height="6" rx="1" />
                      <rect x="1" y="9" width="6" height="6" rx="1" />
                      <rect x="9" y="9" width="6" height="6" rx="1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Base cards */}
              {bases.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-12 text-center"
                  style={{ color: "rgb(97, 102, 112)" }}
                >
                  <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" className="mb-4 opacity-50">
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                  <p style={{ fontSize: "13px", marginBottom: "16px" }}>No bases yet</p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="rounded-md px-4 py-2 transition-colors"
                    style={{
                      backgroundColor: "rgb(22, 110, 225)",
                      color: "white",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(18, 92, 189)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgb(22, 110, 225)")}
                  >
                    Create your first base
                  </button>
                </div>
              ) : viewMode === "grid" ? (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
                >
                  {bases.map((base) => (
                    <button
                      key={base.id}
                      type="button"
                      onClick={() => onSelectBase(base.id)}
                      className="flex text-left transition-all overflow-hidden"
                      style={{
                        height: "92px",
                        backgroundColor: "#fff",
                        boxShadow: cardBoxShadow,
                        borderRadius: "6px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.12) 0px 2px 6px 0px";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = cardBoxShadow;
                      }}
                    >
                      {/* Icon container - fills left side of card */}
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: "92px",
                          height: "92px",
                          borderRadius: "6px 0px 0px 6px",
                        }}
                      >
                        {/* Actual icon */}
                        <div
                          className="flex items-center justify-center text-white"
                          style={{
                            width: "56px",
                            height: "56px",
                            backgroundColor: "rgb(64, 124, 74)",
                            borderRadius: "12px",
                            fontSize: "22px",
                            fontWeight: 500,
                          }}
                        >
                          {getInitials(base.name)}
                        </div>
                      </div>
                      {/* Text content */}
                      <div className="flex flex-col justify-center flex-1 min-w-0 pr-4">
                        <div
                          className="truncate"
                          style={{ fontSize: "13px", fontWeight: 500, color: "rgb(29, 31, 37)" }}
                        >
                          {base.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "rgb(97, 102, 112)", marginTop: "2px" }}>
                          {getTimeAgo(base.updatedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* List view */
                <div>
                  {/* Table header */}
                  <div
                    className="flex items-center px-2 py-2"
                    style={{
                      fontSize: "12px",
                      color: "rgb(97, 102, 112)",
                      borderBottom: "1px solid rgb(225, 227, 230)",
                    }}
                  >
                    <div style={{ flex: "1 1 40%" }}>Name</div>
                    <div style={{ flex: "1 1 30%" }}>Last opened</div>
                    <div style={{ flex: "1 1 30%" }}>Workspace</div>
                  </div>
                  {/* Table rows */}
                  {bases.map((base) => (
                    <button
                      key={base.id}
                      type="button"
                      onClick={() => onSelectBase(base.id)}
                      className="flex items-center w-full text-left px-2 transition-colors"
                      style={{
                        height: "44px",
                        backgroundColor: "#fff",
                        borderBottom: "1px solid rgb(242, 244, 248)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                    >
                      {/* Name column with icon */}
                      <div className="flex items-center gap-3" style={{ flex: "1 1 40%" }}>
                        <div
                          className="flex items-center justify-center text-white flex-shrink-0"
                          style={{
                            width: "24px",
                            height: "24px",
                            backgroundColor: "rgb(64, 124, 74)",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 500,
                          }}
                        >
                          {getInitials(base.name)}
                        </div>
                        <span
                          className="truncate"
                          style={{ fontSize: "13px", fontWeight: 500, color: "rgb(29, 31, 37)" }}
                        >
                          {base.name}
                        </span>
                      </div>
                      {/* Last opened column */}
                      <div style={{ flex: "1 1 30%", fontSize: "13px", color: "rgb(97, 102, 112)" }}>
                        {getTimeAgo(base.updatedAt)}
                      </div>
                      {/* Workspace column */}
                      <div style={{ flex: "1 1 30%", fontSize: "13px", color: "rgb(97, 102, 112)" }}>
                        My First Workspace
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-[400px] rounded-lg p-6"
            style={{
              backgroundColor: "#fff",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "rgb(29, 31, 37)", marginBottom: "16px" }}>
              Create a new base
            </h2>
            <input
              type="text"
              value={newBaseName}
              onChange={(e) => setNewBaseName(e.target.value)}
              placeholder="Enter base name"
              autoFocus
              className="mb-4 w-full rounded-md px-3 outline-none"
              style={{
                height: "40px",
                backgroundColor: "#fff",
                border: "1px solid rgb(225, 227, 230)",
                fontSize: "13px",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgb(22, 110, 225)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgb(225, 227, 230)")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreateModal(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md px-4 py-2 transition-colors"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid rgb(225, 227, 230)",
                  color: "rgb(29, 31, 37)",
                  fontSize: "13px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(242, 244, 248)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newBaseName.trim() || isCreating}
                className="rounded-md px-4 py-2 transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: "rgb(22, 110, 225)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(18, 92, 189)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgb(22, 110, 225)")}
              >
                {isCreating ? "Creating..." : "Create base"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
