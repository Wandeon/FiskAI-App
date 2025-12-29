"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from "@/components/ui/tooltip"

interface ReviewToggleProps {
 clientId: string
 entityType: "EINVOICE" | "EXPENSE" | "DOCUMENT"
 entityId: string
 isReviewed: boolean
 reviewerName?: string | null
 reviewedAt?: Date | null
 onToggle?: (reviewed: boolean) => void
 size?: "sm" | "default"
}

export function ReviewToggle({
 clientId,
 entityType,
 entityId,
 isReviewed,
 reviewerName,
 reviewedAt,
 onToggle,
 size = "sm",
}: ReviewToggleProps) {
 const [reviewed, setReviewed] = useState(isReviewed)
 const [isPending, startTransition] = useTransition()

 const handleToggle = async () => {
 const newValue = !reviewed

 startTransition(async () => {
 try {
 const response = await fetch(`/api/staff/clients/${clientId}/reviews`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 entityType,
 entityId,
 reviewed: newValue,
 }),
 })

 if (response.ok) {
 setReviewed(newValue)
 onToggle?.(newValue)
 }
 } catch (error) {
 console.error("Failed to toggle review status:", error)
 }
 })
 }

 const buttonContent = (
 <Button
 variant={reviewed ? "default" : "outline"}
 size={size}
 onClick={handleToggle}
 disabled={isPending}
 aria-pressed={reviewed}
 aria-busy={isPending}
 aria-label={
 reviewed
   ? "Marked as reviewed. Click to unmark."
   : "Not reviewed. Click to mark as reviewed."
 }
 className={cn(
 "gap-1.5 transition-all",
 reviewed && "bg-success hover:bg-success text-white"
 )}
 >
 {isPending ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" />
 ) : (
 <Check className={cn("h-3.5 w-3.5", !reviewed && "opacity-50")} />
 )}
 <span className="hidden sm:inline">
 {reviewed ? "Pregledano" : "Pregledaj"}
 </span>
 </Button>
 )

 if (reviewed && reviewerName && reviewedAt) {
 return (
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
 <TooltipContent>
 <p>
 Pregledao/la {reviewerName}
 <br />
 {new Date(reviewedAt).toLocaleString("hr-HR")}
 </p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 )
 }

 return buttonContent
}
