'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Bell, User, Settings, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationCenter } from '@/components/ui/notification-center'
import type { NotificationItem } from '@/types/notifications'
import { logout } from '@/app/actions/auth'

type NotificationResponse = {
  items: NotificationItem[]
  unreadCount: number
}

export function StaffHeader() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as NotificationResponse
        setNotifications(data.items ?? [])
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
      } catch (error) {
        console.error('Failed to fetch notifications', error)
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleNotificationOpenChange = async (open: boolean) => {
    if (open && unreadCount > 0) {
      setUnreadCount(0)
      try {
        await fetch('/api/notifications/read', { method: 'POST' })
      } catch (error) {
        console.error('Failed to mark notifications as read', error)
      }
    }
  }

  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold">Staff Portal</h2>

      <div className="flex items-center gap-2">
        <NotificationCenter
          items={notifications}
          badgeCount={unreadCount}
          onOpenChange={handleNotificationOpenChange}
        />
        <StaffUserMenu user={session?.user} />
      </div>
    </header>
  )
}

interface StaffUserMenuProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    systemRole?: string | null
  }
}

function StaffUserMenu({ user }: StaffUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
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

  const handleLogout = async () => {
    setIsPending(true)
    await logout()
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--surface-secondary)] transition-colors focus-ring"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
          {initials}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-[var(--muted)] hidden sm:block transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg animate-scale-in z-50">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="font-semibold text-[var(--foreground)] truncate">
              {user?.name || 'Staff User'}
            </p>
            <p className="text-sm text-[var(--muted)] truncate">{user?.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/staff/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <Settings className="h-4 w-4 text-[var(--muted)]" />
              Postavke
            </Link>
            {user?.systemRole === 'ADMIN' && (
              <Link
                href="/overview"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-[var(--muted)]" />
                Admin Portal
              </Link>
            )}
          </div>
          <div className="border-t border-[var(--border)] p-1">
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isPending ? 'Odjavljujem...' : 'Odjava'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
