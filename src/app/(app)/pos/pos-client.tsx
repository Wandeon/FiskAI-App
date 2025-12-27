"use client"

import { useState, useCallback, useEffect } from "react"
import { ProductGrid } from "./components/product-grid"
import { Cart } from "./components/cart"
import { PaymentBar } from "./components/payment-bar"
import { CashModal } from "./components/cash-modal"
import { CardPaymentModal } from "./components/card-payment-modal"
import { ReceiptModal } from "./components/receipt-modal"
import type { PosProduct, CartItem } from "./types"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  products: PosProduct[]
  companyIban?: string | null
  terminalReaderId?: string | null
}

export function PosClient({ products, companyIban, terminalReaderId }: Props) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [showCashModal, setShowCashModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [saleResult, setSaleResult] = useState<ProcessPosSaleResult | null>(null)

  const addToCart = useCallback((product: PosProduct) => {
    setCartItems((items) => {
      const existing = items.find((i) => i.productId === product.id)
      if (existing) {
        return items.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...items,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: product.price,
          vatRate: product.vatRate,
        },
      ]
    })
  }, [])

  const addCustomItem = useCallback(
    (item: { description: string; unitPrice: number; vatRate: number }) => {
      setCartItems((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          description: item.description,
          quantity: 1,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        },
      ])
    },
    []
  )

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems((items) => items.filter((i) => i.id !== id))
    } else {
      setCartItems((items) => items.map((i) => (i.id === id ? { ...i, quantity } : i)))
    }
  }, [])

  const removeItem = useCallback((id: string) => {
    setCartItems((items) => items.filter((i) => i.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  const total = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity * (1 + item.vatRate / 100),
    0
  )

  const handleSaleComplete = (result: ProcessPosSaleResult) => {
    setSaleResult(result)
    setShowCashModal(false)
    setShowCardModal(false)
  }

  const handleNewSale = () => {
    clearCart()
    setSaleResult(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // F1 = Cash payment
      if (
        e.key === "F1" &&
        cartItems.length > 0 &&
        !showCashModal &&
        !showCardModal &&
        !saleResult
      ) {
        e.preventDefault()
        setShowCashModal(true)
      }
      // F2 = Card payment
      if (
        e.key === "F2" &&
        cartItems.length > 0 &&
        terminalReaderId &&
        !showCashModal &&
        !showCardModal &&
        !saleResult
      ) {
        e.preventDefault()
        setShowCardModal(true)
      }
      // Escape = Close modals
      if (e.key === "Escape") {
        setShowCashModal(false)
        setShowCardModal(false)
        setSaleResult(null)
      }
      // Ctrl+Delete = Clear cart
      if (e.key === "Delete" && e.ctrlKey && !showCashModal && !showCardModal) {
        e.preventDefault()
        clearCart()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cartItems.length, terminalReaderId, showCashModal, showCardModal, saleResult, clearCart])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Blagajna</h1>
          <p className="text-xs text-[var(--muted)]">F1 Gotovina • F2 Kartica • Ctrl+Del Očisti</p>
        </div>
        <div className="flex items-center gap-2">
          {terminalReaderId ? (
            <span className="text-xs text-green-600">● Terminal povezan</span>
          ) : (
            <span className="text-xs text-[var(--muted)]">● Nema terminala</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Product Grid */}
        <div className="flex-1 overflow-auto p-4">
          <ProductGrid
            products={products}
            onProductClick={addToCart}
            onCustomItem={addCustomItem}
          />
        </div>

        {/* Cart */}
        <div className="w-96 bg-[var(--surface)] border-l border-[var(--border)] flex flex-col">
          <Cart items={cartItems} onUpdateQuantity={updateQuantity} onRemove={removeItem} />
        </div>
      </div>

      {/* Payment Bar */}
      <PaymentBar
        total={total}
        disabled={cartItems.length === 0}
        hasTerminal={!!terminalReaderId}
        onCash={() => setShowCashModal(true)}
        onCard={() => setShowCardModal(true)}
        onClear={clearCart}
      />

      {/* Modals */}
      {showCashModal && (
        <CashModal
          items={cartItems}
          total={total}
          onClose={() => setShowCashModal(false)}
          onComplete={handleSaleComplete}
        />
      )}

      {showCardModal && terminalReaderId && (
        <CardPaymentModal
          items={cartItems}
          total={total}
          readerId={terminalReaderId}
          onClose={() => setShowCardModal(false)}
          onComplete={handleSaleComplete}
        />
      )}

      {saleResult && (
        <ReceiptModal
          isOpen={!!saleResult}
          result={saleResult}
          onNewSale={handleNewSale}
          onClose={() => setSaleResult(null)}
        />
      )}
    </div>
  )
}
