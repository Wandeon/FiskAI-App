/* eslint-disable fisk-design-system/no-hardcoded-colors -- @design-override: Email HTML requires inline styles */
// src/app/api/cron/support-escalation/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"
import { Resend } from "resend"
import { logger } from "@/lib/logger"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

// Vercel cron or external cron calls this endpoint
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Initialize Resend inside handler to avoid build-time errors
  if (!process.env.RESEND_API_KEY) {
    logger.error("RESEND_API_KEY not configured for support escalation")
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const now = new Date()
    const results: {
      ticketId: string
      priority: string
      escalationType: string
      emailsSent: number
    }[] = []

    // Define SLA thresholds based on priority (in hours)
    const SLA_THRESHOLDS = {
      URGENT: 1, // 1 hour for URGENT tickets
      HIGH: 4, // 4 hours for HIGH priority tickets
      NORMAL: 24, // 24 hours for NORMAL priority tickets
      LOW: 48, // 48 hours for LOW priority tickets
    }

    // Find tickets that need escalation
    const openTickets = await db.supportTicket.findMany({
      where: {
        status: {
          in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
        },
        escalatedAt: null, // Not already escalated
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
    })

    // Get all platform admins to notify
    const admins = await db.user.findMany({
      where: {
        systemRole: "ADMIN",
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (admins.length === 0) {
      logger.warn("No platform admins found for support escalation notifications")
    }

    for (const ticket of openTickets) {
      const slaThreshold = SLA_THRESHOLDS[ticket.priority] || SLA_THRESHOLDS.NORMAL
      const thresholdMs = slaThreshold * 60 * 60 * 1000
      const ticketAge = now.getTime() - ticket.createdAt.getTime()

      let shouldEscalate = false
      let escalationType = ""

      // Check if ticket has breached SLA
      if (ticketAge > thresholdMs) {
        shouldEscalate = true
        escalationType = "SLA_BREACH"
      }

      // Check for unassigned tickets older than 24 hours
      if (!ticket.assignedToId && ticketAge > 24 * 60 * 60 * 1000) {
        shouldEscalate = true
        escalationType = "UNASSIGNED_STALE"
      }

      // Check for tickets without any response
      const hasResponse = ticket.messages.length > 0
      if (!hasResponse && ticketAge > thresholdMs) {
        shouldEscalate = true
        escalationType = "NO_RESPONSE"
      }

      if (shouldEscalate && admins.length > 0) {
        // Calculate SLA deadline based on priority
        const slaDeadline = new Date(ticket.createdAt.getTime() + thresholdMs)

        // Mark ticket as escalated
        await db.supportTicket.update({
          where: { id: ticket.id },
          data: {
            escalatedAt: now,
            assignedToId: admins[0].id, // Assign to first admin
            slaDeadline: slaDeadline,
          },
        })

        // Send escalation emails to all admins
        let emailsSent = 0
        for (const admin of admins) {
          if (!admin.email) continue

          try {
            await resend.emails.send({
              from: "FiskAI Support <noreply@fiskai.hr>",
              to: admin.email,
              subject: `[ESKALACIJA] ${ticket.priority} prioritet: ${ticket.title}`,
              html: generateEscalationEmailHtml(ticket, escalationType, slaDeadline, admin.name),
            })
            emailsSent++
          } catch (emailError) {
            logger.error(
              { error: emailError, adminEmail: admin.email },
              "Failed to send escalation email"
            )
          }
        }

        results.push({
          ticketId: ticket.id,
          priority: ticket.priority,
          escalationType,
          emailsSent,
        })

        logger.info(
          {
            ticketId: ticket.id,
            priority: ticket.priority,
            escalationType,
            emailsSent,
          },
          "Support ticket escalated"
        )
      }
    }

    return NextResponse.json({
      success: true,
      ticketsProcessed: openTickets.length,
      ticketsEscalated: results.length,
      results,
    })
  } catch (error) {
    logger.error({ error }, "Support escalation cron error")
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

interface TicketForEmail {
  id: string
  title: string
  body: string | null
  priority: SupportTicketPriority
  status: SupportTicketStatus
  createdAt: Date
  category: string
  company: {
    id: string
    name: string
  }
  createdBy: {
    id: string
    name: string | null
    email: string
  } | null
  assignedTo: {
    id: string
    name: string | null
    email: string
  } | null
}

function generateEscalationEmailHtml(
  ticket: TicketForEmail,
  escalationType: string,
  slaDeadline: Date,
  adminName: string | null
): string {
  const ticketAge = Math.floor((Date.now() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
  const hoursOverdue = Math.floor((Date.now() - slaDeadline.getTime()) / (1000 * 60 * 60))

  const escalationTypeLabels: Record<string, string> = {
    SLA_BREACH: "SLA rok prekoračen",
    UNASSIGNED_STALE: "Nedodijeljen >24h",
    NO_RESPONSE: "Bez odgovora",
  }

  const priorityLabels: Record<string, string> = {
    URGENT: "HITNO",
    HIGH: "VISOK",
    NORMAL: "NORMALAN",
    LOW: "NIZAK",
  }

  const priorityColors: Record<string, string> = {
    URGENT: "#dc2626",
    HIGH: "#f59e0b",
    NORMAL: "#0891b2",
    LOW: "#6b7280",
  }

  const escalationReason = escalationTypeLabels[escalationType] || escalationType
  const priorityLabel = priorityLabels[ticket.priority] || ticket.priority
  const priorityColor = priorityColors[ticket.priority] || "#6b7280"

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
          <h2 style="color: #dc2626; margin: 0 0 8px 0;">⚠ Eskalacija Support Ticketa</h2>
          <p style="margin: 0; color: #991b1b; font-size: 14px;">
            <strong>Razlog:</strong> ${escalationReason}
          </p>
        </div>

        <p>Poštovani ${adminName || "administratore"},</p>
        <p>Support ticket zahtijeva vašu pažnju zbog prekoračenja SLA roka:</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="margin-bottom: 12px;">
            <span style="display: inline-block; padding: 4px 12px; background: ${priorityColor}; color: white; border-radius: 4px; font-size: 12px; font-weight: bold;">
              ${priorityLabel}
            </span>
            ${
              ticket.status === "OPEN"
                ? '<span style="margin-left: 8px; display: inline-block; padding: 4px 12px; background: #ef4444; color: white; border-radius: 4px; font-size: 12px;">OTVOREN</span>'
                : '<span style="margin-left: 8px; display: inline-block; padding: 4px 12px; background: #f59e0b; color: white; border-radius: 4px; font-size: 12px;">U RADU</span>'
            }
          </div>

          <h3 style="color: #111827; margin: 0 0 12px 0;">${ticket.title}</h3>

          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            <strong>Tvrtka:</strong> ${ticket.company.name}
          </div>

          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            <strong>Kreirao:</strong> ${ticket.createdBy?.name || ticket.createdBy?.email || "Nepoznato"}
          </div>

          ${
            ticket.assignedTo
              ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            <strong>Dodijeljen:</strong> ${ticket.assignedTo.name || ticket.assignedTo.email}
          </div>`
              : '<div style="font-size: 14px; color: #dc2626; margin-bottom: 8px;"><strong>⚠ Nije dodijeljen</strong></div>'
          }

          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            <strong>Vrijeme otvoreno:</strong> ${ticketAge} h
          </div>

          ${
            hoursOverdue > 0
              ? `<div style="font-size: 14px; color: #dc2626; margin-bottom: 8px;">
            <strong>⚠ Prekoračeno za:</strong> ${hoursOverdue} h
          </div>`
              : ""
          }

          ${
            ticket.body
              ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #374151; font-size: 14px; white-space: pre-wrap;">${ticket.body.substring(0, 300)}${ticket.body.length > 300 ? "..." : ""}</p>
          </div>`
              : ""
          }
        </div>

        <div style="background: #ecfeff; border-left: 4px solid #0891b2; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #0e7490; font-size: 14px;">
            <strong>Sljedeći koraci:</strong><br>
            1. Pregledajte ticket i odredite prioritet<br>
            2. Dodijelite odgovarajućem članu tima ako već nije<br>
            3. Odgovorite klijentu ili poduzmi potrebne radnje
          </p>
        </div>

        <p style="text-align: center; margin: 30px 0;">
          <a href="https://app.fiskai.hr/support/${ticket.id}"
             style="display: inline-block; padding: 14px 28px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Otvori Ticket
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Ovu poruku šalje FiskAI automatski kada support ticketi prekorače SLA rokove.<br>
          Ticket ID: ${ticket.id} | Kreiran: ${ticket.createdAt.toLocaleString("hr-HR")}
        </p>
      </div>
    </body>
    </html>
  `
}
