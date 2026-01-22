"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

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

export function HomePage({ bases, onSelectBase, onCreateBase, isCreating }: HomePageProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBaseName, setNewBaseName] = useState("");
  const [activeNav, setActiveNav] = useState<"home" | "starred" | "shared">("home");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const handleCreate = () => {
    if (!newBaseName.trim()) return;
    onCreateBase(newBaseName.trim());
    setNewBaseName("");
    setShowCreateModal(false);
  };

  return (
    <div
      className="flex h-screen flex-col text-[13px]"
      style={{ backgroundColor: "var(--color-background-default)", color: "var(--color-foreground-default)" }}
    >
      {/* Top Promotional Banner */}
      <div
        className="flex h-[32px] items-center justify-center gap-2 text-[13px]"
        style={{ backgroundColor: "var(--palette-blue-light3)" }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--palette-blue)">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 4v4h3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        <span>
          <a href="#" className="underline" style={{ color: "var(--palette-blue)" }}>
            Invite your friends and coworkers
          </a>
          {" "}to earn account credit.
        </span>
        <button
          type="button"
          className="absolute right-4 rounded p-1 transition-colors"
          style={{ color: "var(--color-foreground-subtle)" }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
      {/* Left Sidebar */}
      <aside
        className="flex w-[220px] flex-col"
        style={{
          backgroundColor: "var(--color-background-default)",
          borderRight: "1px solid var(--color-border-default)",
        }}
      >
        {/* Header with hamburger menu and logo */}
        <div className="flex h-[57px] items-center gap-2 px-3">
          {/* Hamburger Menu */}
          <button
            type="button"
            className="rounded p-2 transition-colors"
            style={{ color: "var(--color-foreground-subtle)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
            </svg>
          </button>
          {/* Airtable Logo - Colorful 3D style */}
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 200 170" fill="none">
              {/* Yellow face */}
              <path d="M90.039 12.368L24.079 39.66c-3.667 1.519-3.63 6.729.062 8.192l66.235 26.266a24.58 24.58 0 0017.402 0l66.234-26.266c3.693-1.463 3.73-6.673.063-8.193l-65.96-27.29a24.58 24.58 0 00-18.076 0z" fill="#FCB400"/>
              {/* Red face */}
              <path d="M105.312 88.46v65.617c0 3.12 3.147 5.258 6.048 4.108l73.806-28.648a4.42 4.42 0 002.79-4.108V59.813c0-3.121-3.147-5.258-6.048-4.108l-73.806 28.648a4.42 4.42 0 00-2.79 4.108z" fill="#FF6366"/>
              {/* Teal face */}
              <path d="M88.078 91.846v65.125c0 3.27-3.512 5.36-6.318 3.762L12.366 117.7a4.42 4.42 0 01-2.16-3.762V48.812c0-3.27 3.512-5.36 6.318-3.762l69.394 43.034a4.42 4.42 0 012.16 3.762z" fill="#18BFFF"/>
            </svg>
            <span className="text-[15px] font-semibold">Airtable</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2">
          {/* Home */}
          <button
            type="button"
            onClick={() => setActiveNav("home")}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors"
            style={{
              backgroundColor: activeNav === "home" ? "var(--color-background-selected-blue)" : "transparent",
              color: activeNav === "home" ? "var(--palette-blue)" : "var(--color-foreground-default)",
            }}
            onMouseEnter={(e) => {
              if (activeNav !== "home") e.currentTarget.style.backgroundColor = "var(--opacity-darken1)";
            }}
            onMouseLeave={(e) => {
              if (activeNav !== "home") e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1L1 6v9h5v-5h4v5h5V6L8 1z" />
            </svg>
            <span>Home</span>
          </button>

          {/* Starred */}
          <button
            type="button"
            onClick={() => setActiveNav("starred")}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] transition-colors"
            style={{
              backgroundColor: activeNav === "starred" ? "var(--color-background-selected-blue)" : "transparent",
              color: activeNav === "starred" ? "var(--palette-blue)" : "var(--color-foreground-default)",
            }}
            onMouseEnter={(e) => {
              if (activeNav !== "starred") e.currentTarget.style.backgroundColor = "var(--opacity-darken1)";
            }}
            onMouseLeave={(e) => {
              if (activeNav !== "starred") e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l2.3 4.6L15 6.3l-3.5 3.4.8 4.9L8 12.3l-4.3 2.3.8-4.9L1 6.3l4.7-.7L8 1z" />
              </svg>
              <span>Starred</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4H4z" />
            </svg>
          </button>

          {/* Starred description */}
          <div className="px-3 py-2">
            <p className="text-[12px]" style={{ color: "var(--color-foreground-subtle)" }}>
              Your starred bases, interfaces, and workspaces will appear here
            </p>
          </div>

          {/* Shared */}
          <button
            type="button"
            onClick={() => setActiveNav("shared")}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors"
            style={{
              backgroundColor: activeNav === "shared" ? "var(--color-background-selected-blue)" : "transparent",
              color: activeNav === "shared" ? "var(--palette-blue)" : "var(--color-foreground-default)",
            }}
            onMouseEnter={(e) => {
              if (activeNav !== "shared") e.currentTarget.style.backgroundColor = "var(--opacity-darken1)";
            }}
            onMouseLeave={(e) => {
              if (activeNav !== "shared") e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12 10a2 2 0 11-4 0 2 2 0 014 0zm-6-4a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Shared</span>
          </button>

          {/* Workspaces */}
          <div className="mt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] transition-colors"
              style={{ color: "var(--color-foreground-default)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 3h6v6H1V3zm8 0h6v6H9V3zm-8 8h6v4H1v-4zm8 0h6v4H9v-4z" />
                </svg>
                <span>Workspaces</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded p-1 transition-colors"
                  style={{ color: "var(--color-foreground-subtle)" }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 4l4 4-4 4V4z" />
                </svg>
              </div>
            </button>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="px-2 py-2" style={{ borderTop: "1px solid var(--color-border-default)" }}>
          {/* Templates and apps */}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors"
            style={{ color: "var(--color-foreground-default)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
            </svg>
            <span>Templates and apps</span>
          </button>

          {/* Marketplace */}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors"
            style={{ color: "var(--color-foreground-default)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 4h12v2H2V4zm0 4h12v6H2V8z" />
            </svg>
            <span>Marketplace</span>
          </button>

          {/* Import */}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors"
            style={{ color: "var(--color-foreground-default)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1v10M4 7l4 4 4-4M2 13h12v2H2v-2z" />
            </svg>
            <span>Import</span>
          </button>
        </div>

        {/* Create button */}
        <div className="p-2">
          <button
            type="button"
            disabled={isCreating}
            onClick={() => setShowCreateModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--palette-blue)",
              color: "white",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-blue-dark1)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-blue)")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Create</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "var(--color-background-default)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Search */}
          <div className="relative flex-1 max-w-[600px] mx-auto">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="var(--color-foreground-subtle)"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-full rounded-full pl-10 pr-4 text-[13px] outline-none"
              style={{
                backgroundColor: "var(--palette-neutral-lightGray1)",
                border: "1px solid var(--color-border-default)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--palette-blue)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border-default)")}
            />
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px]"
              style={{ backgroundColor: "var(--palette-neutral-lightGray2)", color: "var(--color-foreground-subtle)" }}
            >
              ⌘ K
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 ml-4">
            <button
              type="button"
              className="rounded p-2 transition-colors"
              style={{ color: "var(--color-foreground-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 11H7v-2h2v2zm0-4H7V4h2v4z" />
              </svg>
            </button>
            <span className="text-[13px]" style={{ color: "var(--color-foreground-default)" }}>
              Help
            </span>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-medium"
              style={{ backgroundColor: "var(--palette-teal)", color: "white" }}
            >
              N
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <h1 className="text-[24px] font-semibold mb-6" style={{ color: "var(--color-foreground-default)" }}>
            Home
          </h1>

          {/* Start building section */}
          <div className="mb-8">
            <h2 className="text-[16px] font-medium mb-1" style={{ color: "var(--color-foreground-default)" }}>
              Start building
            </h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--color-foreground-subtle)" }}>
              Create apps instantly with AI
            </p>

            {/* Template cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: "OKR Manager", desc: "Align and track team objectives and key results.", icon: "⚙️" },
                { name: "Bug Tracker", desc: "Log, assign, and resolve bugs efficiently.", icon: "✓" },
                { name: "Project Tracker", desc: "Monitor engineering projects from planning to completion.", icon: "▦" },
              ].map((template) => (
                <button
                  key={template.name}
                  type="button"
                  className="flex items-start gap-3 rounded-lg p-4 text-left transition-colors"
                  style={{
                    backgroundColor: "var(--color-background-default)",
                    border: "1px solid var(--color-border-default)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--palette-blue)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border-default)")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded text-[16px]"
                    style={{ backgroundColor: "var(--palette-neutral-lightGray1)" }}
                  >
                    {template.icon}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--color-foreground-default)" }}>
                      {template.name}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--color-foreground-subtle)" }}>
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
                className="flex items-center gap-1 text-[13px] transition-colors"
                style={{ color: "var(--color-foreground-subtle)" }}
              >
                <span>Opened anytime</span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 6l4 4 4-4H4z" />
                </svg>
              </button>

              {/* View toggle */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="rounded p-1.5 transition-colors"
                  style={{
                    backgroundColor: viewMode === "list" ? "var(--color-background-selected-blue)" : "transparent",
                    color: viewMode === "list" ? "var(--palette-blue)" : "var(--color-foreground-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== "list") e.currentTarget.style.backgroundColor = "var(--opacity-darken1)";
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== "list") e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className="rounded p-1.5 transition-colors"
                  style={{
                    backgroundColor: viewMode === "grid" ? "var(--color-background-selected-blue)" : "transparent",
                    color: viewMode === "grid" ? "var(--palette-blue)" : "var(--color-foreground-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== "grid") e.currentTarget.style.backgroundColor = "var(--opacity-darken1)";
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== "grid") e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Base cards */}
            {bases.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-center"
                style={{ color: "var(--color-foreground-subtle)" }}
              >
                <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" className="mb-4 opacity-50">
                  <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
                </svg>
                <p className="text-[13px] mb-4">No bases yet</p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-md px-4 py-2 text-[13px] font-medium transition-colors"
                  style={{ backgroundColor: "var(--palette-blue)", color: "white" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-blue-dark1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-blue)")}
                >
                  Create your first base
                </button>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"}>
                {bases.map((base) => (
                  <button
                    key={base.id}
                    type="button"
                    onClick={() => onSelectBase(base.id)}
                    className={`flex items-center gap-3 rounded-lg text-left transition-colors ${
                      viewMode === "grid" ? "p-4" : "w-full px-4 py-3"
                    }`}
                    style={{
                      backgroundColor: "var(--color-background-default)",
                      border: "1px solid var(--color-border-default)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--palette-blue)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border-default)")}
                  >
                    {/* Base avatar */}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md text-[14px] font-semibold"
                      style={{ backgroundColor: "var(--palette-teal)", color: "white" }}
                    >
                      {getInitials(base.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-medium truncate"
                        style={{ color: "var(--color-foreground-default)" }}
                      >
                        {base.name}
                      </div>
                      <div className="text-[12px]" style={{ color: "var(--color-foreground-subtle)" }}>
                        {getTimeAgo(base.updatedAt)}
                      </div>
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
              backgroundColor: "var(--color-background-raised-popover)",
              boxShadow: "var(--elevation-high)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-semibold mb-4" style={{ color: "var(--color-foreground-default)" }}>
              Create a new base
            </h2>
            <input
              type="text"
              value={newBaseName}
              onChange={(e) => setNewBaseName(e.target.value)}
              placeholder="Enter base name"
              autoFocus
              className="mb-4 h-10 w-full rounded-md px-3 text-[13px] outline-none"
              style={{
                backgroundColor: "var(--color-background-default)",
                border: "1px solid var(--color-border-default)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--palette-blue)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border-default)")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreateModal(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md px-4 py-2 text-[13px] transition-colors"
                style={{
                  backgroundColor: "var(--color-background-default)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-foreground-default)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--opacity-darken1)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-background-default)")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newBaseName.trim() || isCreating}
                className="rounded-md px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--palette-blue)", color: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-blue-dark1)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--palette-blue)")}
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
