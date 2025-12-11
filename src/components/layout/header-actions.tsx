'use client'

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Plus,
  FileText,
  Users,
  Package,
  Bell,
  ChevronDown,
  Settings,
  User
} from "lucide-react"
import { LogoutButton } from "./logout-button"

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
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const actions = [
    { name: 'Novi račun', href: '/invoices/new', icon: FileText },
    { name: 'Novi e-račun', href: '/e-invoices/new', icon: FileText },
    { name: 'Novi kontakt', href: '/contacts/new', icon: Users },
    { name: 'Novi proizvod', href: '/products/new', icon: Package },
  ]

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-button bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors focus-ring"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Novo</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-elevated animate-scale-in z-50">
          <div className="p-1">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <action.icon className="h-4 w-4 text-[var(--muted)]" />
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
  count?: number
  className?: string
}

export function Notifications({ count = 0, className }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors focus-ring"
        aria-label="Obavijesti"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-elevated animate-scale-in z-50">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="font-semibold text-[var(--foreground)]">Obavijesti</h3>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {count === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--muted)]">
                Nema novih obavijesti
              </div>
            ) : (
              <div className="p-2">
                {/* Placeholder notifications - in real app, would come from props/API */}
                <div className="rounded-lg px-3 py-2 hover:bg-[var(--surface-secondary)]">
                  <p className="text-sm text-[var(--foreground)]">Novi e-račun od Primjer d.o.o.</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Prije 5 minuta</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--border)] px-4 py-2">
            <Link
              href="/notifications"
              className="text-sm text-brand-600 hover:text-brand-700"
              onClick={() => setIsOpen(false)}
            >
              Prikaži sve obavijesti
            </Link>
          </div>
        </div>
      )}
    </div>
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
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--surface-secondary)] transition-colors focus-ring"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'User'}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
            {initials}
          </div>
        )}
        <ChevronDown className={cn("h-4 w-4 text-[var(--muted)] hidden sm:block transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-elevated animate-scale-in z-50">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="font-medium text-[var(--foreground)] truncate">{user.name || 'Korisnik'}</p>
            <p className="text-sm text-[var(--muted)] truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/settings/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <User className="h-4 w-4 text-[var(--muted)]" />
              Moj profil
            </Link>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <Settings className="h-4 w-4 text-[var(--muted)]" />
              Postavke
            </Link>
          </div>
          <div className="border-t border-[var(--border)] p-1">
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
  isConnected?: boolean
  draftCount?: number
  className?: string
}

export function CompanyStatus({ companyName, isConnected = false, draftCount = 0, className }: CompanyStatusProps) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5", className)}>
      <div className={cn(
        "h-2 w-2 rounded-full",
        isConnected ? "bg-success-500" : "bg-warning-500"
      )} />
      <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-[120px]">
        {companyName}
      </span>
      {draftCount > 0 && (
        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-700">
          {draftCount} nacrt{draftCount === 1 ? '' : draftCount < 5 ? 'a' : 'a'}
        </span>
      )}
    </div>
  )
}
