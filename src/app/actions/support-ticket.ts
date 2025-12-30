// src/app/actions/support-ticket.ts
// Enhanced support ticket actions for improved operations

import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  getCurrentUser,
  getCurrentCompany,
} from "@/lib/auth-utils"
import {
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicket,
  SupportTicketMessage,
} from "@prisma/client"
import { logger } from "@/lib/logger"

export const createSupportTicketSchema = z.object({
  title: z.string().min(3, "Naslov je prekratak").max(200, "Naslov je predugačak"),
  body: z.string().max(5000, "Tijelo poruke je predugačko").optional(),
  priority: z.nativeEnum(SupportTicketPriority).default(SupportTicketPriority.NORMAL),
})

export const updateSupportTicketSchema = z.object({
  title: z.string().min(3, "Naslov je prekratak").max(200, "Naslov je predugačak").optional(),
  body: z.string().max(5000, "Tijelo poruke je predugačko").optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  status: z.nativeEnum(SupportTicketStatus).optional(),
})

export const addSupportMessageSchema = z.object({
  body: z.string().min(1, "Poruka je obavezna").max(5000, "Poruka je predugačka"),
})

export interface CreateSupportTicketInput {
  title: string
  body?: string
  priority?: SupportTicketPriority
}

export interface UpdateSupportTicketInput {
  title?: string
  body?: string
  priority?: SupportTicketPriority
  status?: SupportTicketStatus
}

export interface AddSupportMessageInput {
  body: string
}

export async function assignSupportTicket(ticketId: string, userId: string | null) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Verify user has STAFF or ADMIN role
      if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
        return { success: false, error: "Nemate dozvolu za dodjelu tiketa" }
      }

      // Verify ticket belongs to the user's company
      const ticket = await db.supportTicket.findFirst({
        where: { id: ticketId, companyId: company.id },
        select: { id: true },
      })

      if (!ticket) {
        return { success: false, error: "Tiket nije pronađen" }
      }

      // Verify userId is valid staff/admin if not null
      if (userId) {
        const assignee = await db.user.findFirst({
          where: {
            id: userId,
            systemRole: { in: ["STAFF", "ADMIN"] },
          },
          select: { id: true },
        })

        if (!assignee) {
          return { success: false, error: "Nevažeći korisnik za dodjelu" }
        }
      }

      await db.supportTicket.update({
        where: { id: ticketId },
        data: { assignedToId: userId },
      })

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId,
          assignedToId: userId,
          operation: "support_ticket_assigned",
        },
        "Support ticket assigned"
      )

      return { success: true }
    })
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to assign ticket")
    return { success: false, error: "Dodjela nije uspjela" }
  }
}

/**
 * Create a new support ticket
 */
export async function createSupportTicket(input: CreateSupportTicketInput) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const validated = createSupportTicketSchema.parse(input)

      // Calculate SLA deadline based on priority
      const SLA_HOURS = {
        URGENT: 1,
        HIGH: 4,
        NORMAL: 24,
        LOW: 48,
      }
      const slaHours = SLA_HOURS[validated.priority] || SLA_HOURS.NORMAL
      const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000)

      const ticket = await db.supportTicket.create({
        data: {
          companyId: company.id,
          createdById: user.id!,
          assignedToId: null, // Initially unassigned
          title: validated.title.trim(),
          body: validated.body?.trim() || null,
          priority: validated.priority,
          status: SupportTicketStatus.OPEN,
          slaDeadline,
        },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId: ticket.id,
          operation: "support_ticket_created",
        },
        "Support ticket created"
      )

      return { success: true, data: ticket }
    })
  } catch (error) {
    logger.error({ error }, "Failed to create support ticket")

    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data", details: error.issues }
    }

    return { success: false, error: "Failed to create support ticket" }
  }
}

/**
 * Get a specific support ticket
 */
export async function getSupportTicket(ticketId: string) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const ticket = await db.supportTicket.findFirst({
        where: { id: ticketId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      })

      if (!ticket) {
        return { success: false, error: "Ticket not found" }
      }

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId,
          operation: "support_ticket_fetched",
        },
        "Support ticket fetched"
      )

      return { success: true, data: ticket }
    })
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to get support ticket")
    return { success: false, error: "Failed to get support ticket" }
  }
}

/**
 * Get all support tickets for a company with optional filters
 */
export async function getSupportTickets(
  status?: SupportTicketStatus[],
  priority?: SupportTicketPriority[],
  limit: number = 50,
  page: number = 1
) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const skip = (page - 1) * limit

      const whereClause: any = {}

      if (status && status.length > 0) {
        whereClause.status = { in: status }
      }

      if (priority && priority.length > 0) {
        whereClause.priority = { in: priority }
      }

      const [tickets, totalCount] = await Promise.all([
        db.supportTicket.findMany({
          where: whereClause,
          take: limit,
          skip,
          orderBy: { updatedAt: "desc" },
          include: {
            messages: {
              select: {
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        }),
        db.supportTicket.count({ where: whereClause }),
      ])

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          operation: "support_tickets_fetched",
          count: tickets.length,
          total: totalCount,
        },
        "Support tickets fetched"
      )

      return {
        success: true,
        data: tickets,
        meta: {
          totalCount,
          page,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: skip + tickets.length < totalCount,
          hasPrevPage: page > 1,
        },
      }
    })
  } catch (error) {
    logger.error({ error }, "Failed to get support tickets")
    return { success: false, error: "Failed to get support tickets" }
  }
}

/**
 * Update a support ticket
 */
export async function updateSupportTicket(ticketId: string, input: UpdateSupportTicketInput) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Verify ticket belongs to company (automatically filtered by tenant context)
      const existingTicket = await db.supportTicket.findFirst({
        where: { id: ticketId },
        select: { id: true },
      })

      if (!existingTicket) {
        return { success: false, error: "Ticket not found" }
      }

      // Validate input
      const validated = updateSupportTicketSchema.partial().parse(input)

      // Prepare update data
      const updateData: any = {}
      if (validated.title !== undefined) updateData.title = validated.title.trim()
      if (validated.body !== undefined) updateData.body = validated.body.trim()
      if (validated.priority !== undefined) updateData.priority = validated.priority
      if (validated.status !== undefined) {
        updateData.status = validated.status
        // If status is being changed to RESOLVED/CLOSED, update resolvedAt
        if (
          validated.status === SupportTicketStatus.RESOLVED ||
          validated.status === SupportTicketStatus.CLOSED
        ) {
          updateData.resolvedAt = new Date()
        }
      }

      const ticket = await db.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId,
          operation: "support_ticket_updated",
          changes: Object.keys(updateData),
        },
        "Support ticket updated"
      )

      return { success: true, data: ticket }
    })
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to update support ticket")

    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data", details: error.issues }
    }

    return { success: false, error: "Failed to update support ticket" }
  }
}

/**
 * Add a message to a support ticket
 */
export async function addSupportTicketMessage(ticketId: string, input: AddSupportMessageInput) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Verify ticket belongs to company (automatically filtered by tenant context)
      const ticket = await db.supportTicket.findFirst({
        where: { id: ticketId },
        select: { id: true },
      })

      if (!ticket) {
        return { success: false, error: "Ticket not found" }
      }

      const validated = addSupportMessageSchema.parse(input)

      const message = await db.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id!,
          body: validated.body.trim(),
        },
      })

      // Update ticket's updatedAt
      await db.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      })

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId,
          messageId: message.id,
          operation: "support_ticket_message_added",
        },
        "Support ticket message added"
      )

      return { success: true, data: message }
    })
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to add support ticket message")

    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data", details: error.issues }
    }

    return { success: false, error: "Failed to add support ticket message" }
  }
}

/**
 * Close a support ticket
 */
export async function closeSupportTicket(ticketId: string, resolutionNote?: string) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Verify ticket belongs to company (automatically filtered by tenant context)
      const ticket = await db.supportTicket.findFirst({
        where: { id: ticketId },
        select: { id: true, status: true, body: true },
      })

      if (!ticket) {
        return { success: false, error: "Ticket not found" }
      }

      // If ticket is already closed, return success
      if (ticket.status === SupportTicketStatus.CLOSED) {
        return { success: true, data: { ...ticket, status: SupportTicketStatus.CLOSED } }
      }

      const updatedTicket = await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.CLOSED,
          ...(resolutionNote && {
            body: `${ticket.body || ""}\n\n---\nRješenje: ${resolutionNote}`.trim(),
          }),
        },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId,
          operation: "support_ticket_closed",
        },
        "Support ticket closed"
      )

      return { success: true, data: updatedTicket }
    })
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to close support ticket")
    return { success: false, error: "Failed to close support ticket" }
  }
}

/**
 * Reopen a support ticket
 */
export async function reopenSupportTicket(ticketId: string) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Verify ticket belongs to company (automatically filtered by tenant context)
      const ticket = await db.supportTicket.findFirst({
        where: {
          id: ticketId,
          status: { in: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] },
        },
        select: { id: true },
      })

      if (!ticket) {
        return { success: false, error: "Ticket not found or not in closed/resolved state" }
      }

      const updatedTicket = await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.OPEN,
        },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      logger.info(
        {
          userId: user.id,
          companyId: company.id,
          ticketId,
          operation: "support_ticket_reopened",
        },
        "Support ticket reopened"
      )

      return { success: true, data: updatedTicket }
    })
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to reopen support ticket")
    return { success: false, error: "Failed to reopen support ticket" }
  }
}
