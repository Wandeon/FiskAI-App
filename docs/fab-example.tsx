// Example: Using FAB (Floating Action Button) component
// This demonstrates how to add a mobile-only floating action button

'use client'

import { FAB } from '@/components/ui/fab'
import { useRouter } from 'next/navigation'

// Example 1: Add New Invoice FAB
export function InvoicePageWithFAB() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Your page content here */}
      <h1>Dokumenti</h1>
      {/* ... rest of the page ... */}

      {/* FAB - only visible on mobile */}
      <FAB
        icon={
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        }
        onClick={() => router.push('/invoices/new')}
        label="Dodaj novi račun"
      />
    </div>
  )
}

// Example 2: Custom Styled FAB
export function CustomFAB() {
  const router = useRouter()

  return (
    <FAB
      icon={
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      }
      onClick={() => router.push('/expenses/new')}
      label="Dodaj novi trošak"
      className="bg-green-600 hover:bg-green-700"
    />
  )
}

// Example 3: FAB with Action Menu
export function FABWithMenu() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  return (
    <>
      {/* Action menu - appears when FAB is clicked */}
      {isMenuOpen && (
        <div className="fixed bottom-24 right-6 z-30 flex flex-col gap-2 md:hidden">
          <button
            onClick={() => {
              router.push('/invoices/new?type=INVOICE')
              setIsMenuOpen(false)
            }}
            className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50"
          >
            <span>📋</span>
            <span>Novi račun</span>
          </button>
          <button
            onClick={() => {
              router.push('/invoices/new?type=QUOTE')
              setIsMenuOpen(false)
            }}
            className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50"
          >
            <span>📄</span>
            <span>Nova ponuda</span>
          </button>
          <button
            onClick={() => {
              router.push('/expenses/new')
              setIsMenuOpen(false)
            }}
            className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50"
          >
            <span>💸</span>
            <span>Novi trošak</span>
          </button>
        </div>
      )}

      {/* Backdrop to close menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Main FAB */}
      <FAB
        icon={
          <svg
            className={`h-6 w-6 transition-transform ${isMenuOpen ? 'rotate-45' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        }
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        label="Otvori izbornik radnji"
      />
    </>
  )
}

// Note: Remember to import React if using useState
import React from 'react'
