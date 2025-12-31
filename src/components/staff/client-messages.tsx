"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageSquare, Plus, Send, Clock, CheckCircle2, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  body: string
  createdAt: string
  authorId: string | null
  author?: {
    id: string
    name: string | null
    email: string
    systemRole: string
  } | null
}

interface Ticket {
  id: string
  title: string
  body: string | null
  status: string
  priority: string
  category: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

interface StaffClientMessagesProps {
  clientId: string
  clientName: string
  initialTickets: Ticket[]
}

const statusColors: Record<string, string> = {
  OPEN: "bg-info-bg text-info-text",
  IN_PROGRESS: "bg-warning-bg text-warning-text",
  RESOLVED: "bg-success-bg text-success-text",
  CLOSED: "bg-surface-2 text-secondary",
}

const statusIcons: Record<string, React.ReactNode> = {
  OPEN: <Clock className="h-3 w-3" />,
  IN_PROGRESS: <AlertCircle className="h-3 w-3" />,
  RESOLVED: <CheckCircle2 className="h-3 w-3" />,
  CLOSED: <X className="h-3 w-3" />,
}

const priorityColors: Record<string, string> = {
  LOW: "bg-surface-1 text-secondary",
  NORMAL: "bg-info-bg text-info-icon",
  HIGH: "bg-warning-bg text-warning-text",
  URGENT: "bg-danger-bg text-danger-icon",
}

export function StaffClientMessages({
  clientId,
  clientName,
  initialTickets,
}: StaffClientMessagesProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newTicketTitle, setNewTicketTitle] = useState("")
  const [newTicketBody, setNewTicketBody] = useState("")
  const [newTicketPriority, setNewTicketPriority] = useState("NORMAL")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (selectedTicket) {
      scrollToBottom()
    }
  }, [selectedTicket])

  const loadTicketMessages = async (ticketId: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/staff/clients/${clientId}/messages?ticketId=${ticketId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data.ticket)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/staff/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedTicket.id, body: newMessage.trim() }),
      })

      if (res.ok) {
        setNewMessage("")
        await loadTicketMessages(selectedTicket.id)
        // Refresh tickets list
        const ticketsRes = await fetch(`/api/staff/clients/${clientId}/messages`)
        if (ticketsRes.ok) {
          const data = await ticketsRes.json()
          setTickets(data.tickets)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const createTicket = async () => {
    if (!newTicketTitle.trim() || !newTicketBody.trim()) return

    setIsCreating(true)
    try {
      const res = await fetch(`/api/staff/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTicketTitle.trim(),
          body: newTicketBody.trim(),
          priority: newTicketPriority,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setShowNewDialog(false)
        setNewTicketTitle("")
        setNewTicketBody("")
        setNewTicketPriority("NORMAL")
        // Refresh tickets
        const ticketsRes = await fetch(`/api/staff/clients/${clientId}/messages`)
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json()
          setTickets(ticketsData.tickets)
        }
        // Select the new ticket
        await loadTicketMessages(data.ticket.id)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await fetch(`/api/staff/clients/${clientId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status }),
      })

      if (res.ok) {
        // Refresh tickets
        const ticketsRes = await fetch(`/api/staff/clients/${clientId}/messages`)
        if (ticketsRes.ok) {
          const data = await ticketsRes.json()
          setTickets(data.tickets)
        }
        if (selectedTicket?.id === ticketId) {
          await loadTicketMessages(ticketId)
        }
      }
    } catch (error) {
      console.error("Failed to update status:", error)
    }
  }

  const filteredTickets =
    statusFilter === "all" ? tickets : tickets.filter((t) => t.status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communication with {clientName}</p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
              <DialogDescription>Create a new message thread with {clientName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  placeholder="Enter conversation subject..."
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={newTicketPriority} onValueChange={setNewTicketPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  placeholder="Type your message..."
                  value={newTicketBody}
                  onChange={(e) => setNewTicketBody(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={createTicket}
                disabled={isCreating || !newTicketTitle.trim() || !newTicketBody.trim()}
              >
                {isCreating ? "Creating..." : "Start Conversation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ticket List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conversations</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => loadTicketMessages(ticket.id)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-accent transition-colors",
                        selectedTicket?.id === ticket.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ticket.title}</p>
                          {ticket.messages[0] && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {ticket.messages[0].body}
                            </p>
                          )}
                        </div>
                        <Badge className={cn("shrink-0 text-xs", statusColors[ticket.status])}>
                          {statusIcons[ticket.status]}
                          <span className="ml-1">{ticket.status.replace("_", " ")}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", priorityColors[ticket.priority])}
                        >
                          {ticket.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedTicket.title}</CardTitle>
                    <CardDescription>
                      Created {new Date(selectedTicket.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(status) => updateTicketStatus(selectedTicket.id, status)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[400px]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedTicket.messages.map((message) => {
                    const isStaff =
                      message.author?.systemRole === "STAFF" ||
                      message.author?.systemRole === "ADMIN"
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isStaff ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2",
                            isStaff ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium opacity-75">
                              {message.author?.name || message.author?.email || "Unknown"}
                            </span>
                            {isStaff && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                Staff
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                          <p
                            className={cn(
                              "text-[10px] mt-1",
                              isStaff ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}
                          >
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      className="min-h-[60px] resize-none"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={isLoading || !newMessage.trim()}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="h-[480px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the list or start a new one</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
