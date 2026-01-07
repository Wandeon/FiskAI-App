"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  Plus,
  FileText,
  Users,
  Package,
  ChevronDown,
  Settings,
  User,
  HelpCircle,
} from "lucide-react"
import { LogoutButton } from "./logout-button"
import { NotificationCenter } from "@/components/ui/notification-center"
import type { NotificationItem } from "@/types/notifications"

// Quick Actions Dropdown
interface QuickActionsProps {
  className?: string
}

export function QuickActions({ className }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const actions = [
    { name: "Novi račun", href: "/invoices/new", icon: FileText },
    { name: "Novi e-račun", href: "/e-invoices/new", icon: FileText },
    { name: "Novi kontakt", href: "/contacts/new", icon: Users },
    { name: "Novi proizvod", href: "/products/new", icon: Package },
  ]

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-brand-600/95 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all focus-ring hover:bg-brand-600"
      >
        <Plus className="icon-md" />
        <span className="hidden sm:inline">Novo</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl surface-glass border-white/10 shadow-glow animate-scale-in z-50 origin-top-right">
          <div className="p-1">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--foreground)] hover:bg-surface/10 transition-colors"
              >
                <action.icon className="icon-md text-[var(--muted)]" />
                {action.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Notifications Bell
interface NotificationsProps {
  initialItems?: NotificationItem[]
  initialUnreadCount?: number
  className?: string
}

type NotificationResponse = {
  items: NotificationItem[]
  unreadCount: number
}

export function Notifications({
  initialItems = [],
  initialUnreadCount = 0,
  className,
}: NotificationsProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as NotificationResponse
      setItems(data.items ?? [])
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0)
    } catch (error) {
      console.error("Failed to fetch notifications", error)
    }
  }, [])

  const markAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read", { method: "POST" })
    } catch (error) {
      console.error("Failed to mark notifications as read", error)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => void fetchNotifications(), 60000)
    void fetchNotifications()
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        void fetchNotifications()
        if (unreadCount > 0) {
          setUnreadCount(0)
          void markAsRead()
        }
      }
    },
    [fetchNotifications, markAsRead, unreadCount]
  )

  return (
    <NotificationCenter
      items={items}
      className={className}
      badgeCount={unreadCount}
      onOpenChange={handleOpenChange}
    />
  )
}

// User Avatar Menu
interface UserMenuProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  className?: string
}

export function UserMenu({ user, className }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || "U"

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--surface-secondary)] transition-colors focus-ring"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || "User"}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
            {initials}
          </div>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--muted)] hidden sm:block transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl surface-glass border-white/10 shadow-glow animate-scale-in z-50">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="font-semibold text-[var(--foreground)] truncate">
              {user.name || "Korisnik"}
            </p>
            <p className="text-sm text-[var(--muted)] truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/settings/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-surface/10 transition-colors"
            >
              <User className="icon-md text-[var(--muted)]" />
              Moj profil
            </Link>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-surface/10 transition-colors"
            >
              <Settings className="icon-md text-[var(--muted)]" />
              Postavke
            </Link>
            <Link
              href="/support"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-surface/10 transition-colors"
            >
              <HelpCircle className="icon-md text-[var(--muted)]" />
              Pomoć i podrška
            </Link>
          </div>
          <div className="border-t border-white/10 p-1">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  )
}

// Company Status Pill
interface CompanyStatusProps {
  companyName: string
  companyOib?: string | null
  isConnected?: boolean
  draftCount?: number
  className?: string
}

export function CompanyStatus({
  companyName,
  companyOib,
  isConnected = false,
  draftCount = 0,
  className,
}: CompanyStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5",
        className
      )}
    >
      <div
        className={cn("h-2 w-2 rounded-full", isConnected ? "bg-success-500" : "bg-warning-500")}
      />
      <div className="flex flex-col max-w-[160px]">
        <span className="text-sm font-medium text-[var(--foreground)] truncate">{companyName}</span>
        {companyOib && (
          <span className="text-xs text-[var(--muted)] truncate">OIB: {companyOib}</span>
        )}
      </div>
      {draftCount > 0 && (
        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-700">
          {draftCount} nacrt{draftCount === 1 ? "" : draftCount < 5 ? "a" : "a"}
        </span>
      )}
    </div>
  )
}
