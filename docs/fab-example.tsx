// Example: Using FAB (Floating Action Button) component
// This demonstrates how to add a mobile-only floating action button with multi-action menu

'use client'

import { FAB } from '@/components/ui/fab'
import { FileText, Users, Package, Receipt } from 'lucide-react'

// Example 1: Using Default FAB (with built-in actions)
export function InvoicePageWithDefaultFAB() {
  return (
    <div className="space-y-6">
      {/* Your page content here */}
      <h1>Dokumenti</h1>
      {/* ... rest of the page ... */}

      {/* FAB - only visible on mobile, includes default actions */}
      <FAB />
    </div>
  )
}

// Example 2: Custom Actions FAB
export function CustomActionsFAB() {
  const customActions = [
    { href: "/invoices/new?type=INVOICE", icon: <FileText className="h-5 w-5" />, label: "Račun" },
    { href: "/invoices/new?type=QUOTE", icon: <FileText className="h-5 w-5" />, label: "Ponuda" },
    { href: "/expenses/new", icon: <Receipt className="h-5 w-5" />, label: "Trošak" },
  ]

  return (
    <div className="space-y-6">
      {/* Your page content here */}
      <h1>Dokumenti</h1>
      {/* ... rest of the page ... */}

      {/* FAB with custom actions */}
      <FAB actions={customActions} />
    </div>
  )
}

// Example 3: FAB with Custom Styling
export function StyledFAB() {
  const actions = [
    { href: "/contacts/new", icon: <Users className="h-5 w-5" />, label: "Kontakt" },
    { href: "/products/new", icon: <Package className="h-5 w-5" />, label: "Proizvod" },
  ]

  return (
    <div className="space-y-6">
      <h1>Settings</h1>

      {/* FAB with custom positioning */}
      <FAB actions={actions} className="!right-8 !bottom-24" />
    </div>
  )
}

// Note: The new FAB component now includes:
// - Built-in multi-action menu that expands on click
// - Automatic mobile-only rendering (md:hidden)
// - Smooth animations for action items
// - Labels that appear next to each action
// - Plus icon that rotates to X when menu is open
