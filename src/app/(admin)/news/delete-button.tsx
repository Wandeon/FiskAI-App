"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface DeleteButtonProps {
  postId: string
  postTitle: string
}

export function DeleteButton({ postId, postTitle }: DeleteButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch("/api/admin/news/posts/" + postId, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete post")
      }
      router.refresh()
    } catch (error) {
      console.error("Error deleting post:", error)
      alert(error instanceof Error ? error.message : "Failed to delete post")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-lg border border-[var(--border)] p-2 text-danger-icon hover:bg-[var(--surface-secondary)] disabled:opacity-50"
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
