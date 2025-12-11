'use client'

import { useState, useCallback } from 'react'

interface ConfirmState {
  isOpen: boolean
  title: string
  description?: string
  onConfirm: () => void | Promise<void>
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  })
  const [loading, setLoading] = useState(false)

  const confirm = useCallback((options: Omit<ConfirmState, 'isOpen'>) => {
    setState({
      isOpen: true,
      ...options,
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    setLoading(true)
    try {
      await state.onConfirm()
      setState(s => ({ ...s, isOpen: false }))
    } finally {
      setLoading(false)
    }
  }, [state])

  const handleClose = useCallback(() => {
    if (!loading) {
      setState(s => ({ ...s, isOpen: false }))
    }
  }, [loading])

  return {
    ...state,
    loading,
    confirm,
    handleConfirm,
    handleClose,
  }
}
