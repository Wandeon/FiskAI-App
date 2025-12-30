import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import SupportTicketCreatedEmail from "@/lib/email/templates/support-ticket-created-email"
import SupportMessageEmail from "@/lib/email/templates/support-message-email"
import SupportStatusChangedEmail from "@/lib/email/templates/support-status-changed-email"
import SupportTicketAssignedEmail from "@/lib/email/templates/support-ticket-assigned-email"
import { SupportTicketPriority, TicketCategory } from "@prisma/client"

interface TicketRecipient { email: string; name?: string }

async function getTicketRecipients(companyId: string, excludeUserId?: string): Promise<TicketRecipient[]> {
  const [staffAssignments, companyAdmins] = await Promise.all([
    db.staffAssignment.findMany({
      where: { companyId },
      include: { staff: { select: { id: true, email: true, name: true } } },
    }),
    db.companyUser.findMany({
      where: { companyId, role: { in: ["ADMIN", "OWNER"] }, ...(excludeUserId && { userId: { not: excludeUserId } }) },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
  ])

  const recipientIds = new Set<string>()
  const recipients: TicketRecipient[] = []
  
  staffAssignments.forEach((a) => {
    if (a.staff.id !== excludeUserId && !recipientIds.has(a.staff.id)) {
      recipientIds.add(a.staff.id)
      recipients.push({ email: a.staff.email, name: a.staff.name || undefined })
    }
  })
  
  companyAdmins.forEach((a) => {
    if (a.user.id !== excludeUserId && !recipientIds.has(a.user.id)) {
      recipientIds.add(a.user.id)
      recipients.push({ email: a.user.email, name: a.user.name || undefined })
    }
  })
  
  return recipients
}

export async function notifyTicketCreated(params: {
  ticketId: string; ticketTitle: string; ticketBody?: string | null; priority: SupportTicketPriority
  category: TicketCategory; createdByUserId: string; createdByName?: string | null; createdByEmail: string
  companyId: string; companyName: string
}) {
  try {
    const recipients = await getTicketRecipients(params.companyId, params.createdByUserId)
    if (!recipients.length) return

    const baseUrl = process.env.NEXTAUTH_URL || "https://app.fiskai.hr"
    const ticketUrl = `${baseUrl}/support/tickets/${params.ticketId}`

    for (const recipient of recipients) {
      await sendEmail({
        to: recipient.email,
        subject: `Novi support tiket: ${params.ticketTitle}`,
        react: SupportTicketCreatedEmail({
          ticketId: params.ticketId, ticketTitle: params.ticketTitle, ticketBody: params.ticketBody || undefined,
          priority: params.priority, category: params.category, createdByName: params.createdByName || undefined,
          createdByEmail: params.createdByEmail, companyName: params.companyName, ticketUrl,
        }),
      })
    }
  } catch (error) {
    console.error("Failed to send ticket creation notification:", error)
    throw error
  }
}

export async function notifyMessageAdded(params: {
  ticketId: string; ticketTitle: string; messageBody: string; authorUserId: string
  authorName?: string | null; authorEmail: string; companyId: string; companyName: string
}) {
  try {
    const recipients = await getTicketRecipients(params.companyId, params.authorUserId)
    if (!recipients.length) return

    const baseUrl = process.env.NEXTAUTH_URL || "https://app.fiskai.hr"
    const ticketUrl = `${baseUrl}/support/tickets/${params.ticketId}`

    for (const recipient of recipients) {
      await sendEmail({
        to: recipient.email,
        subject: `Nova poruka na tiketu: ${params.ticketTitle}`,
        react: SupportMessageEmail({
          ticketId: params.ticketId, ticketTitle: params.ticketTitle, messageBody: params.messageBody,
          authorName: params.authorName || undefined, authorEmail: params.authorEmail,
          companyName: params.companyName, ticketUrl,
        }),
      })
    }
  } catch (error) {
    console.error("Failed to send message notification:", error)
    throw error
  }
}

export async function notifyStatusChanged(params: {
  ticketId: string; ticketTitle: string; oldStatus: string; newStatus: string; changedByUserId: string
  changedByName?: string | null; changedByEmail: string; companyId: string; companyName: string
}) {
  try {
    const recipients = await getTicketRecipients(params.companyId, params.changedByUserId)
    if (!recipients.length) return

    const baseUrl = process.env.NEXTAUTH_URL || "https://app.fiskai.hr"
    const ticketUrl = `${baseUrl}/support/tickets/${params.ticketId}`

    for (const recipient of recipients) {
      await sendEmail({
        to: recipient.email,
        subject: `Status tiketa promijenjen: ${params.ticketTitle}`,
        react: SupportStatusChangedEmail({
          ticketId: params.ticketId, ticketTitle: params.ticketTitle, oldStatus: params.oldStatus,
          newStatus: params.newStatus, changedByName: params.changedByName || undefined,
          changedByEmail: params.changedByEmail, companyName: params.companyName, ticketUrl,
        }),
      })
    }
  } catch (error) {
    console.error("Failed to send status change notification:", error)
    throw error
  }
}

export async function notifyTicketAssigned(params: {
  ticketId: string; ticketTitle: string; ticketBody?: string | null; priority: SupportTicketPriority; category: TicketCategory
  assignedToUserId: string; assignedToName?: string | null; assignedToEmail: string; assignedByUserId: string
  assignedByName?: string | null; assignedByEmail: string; companyId: string; companyName: string
}) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "https://app.fiskai.hr"
    const ticketUrl = `${baseUrl}/support/tickets/${params.ticketId}`

    await sendEmail({
      to: params.assignedToEmail,
      subject: `Dodijeljen vam je tiket: ${params.ticketTitle}`,
      react: SupportTicketAssignedEmail({
        ticketId: params.ticketId, ticketTitle: params.ticketTitle, ticketBody: params.ticketBody || undefined,
        priority: params.priority, category: params.category, assignedByName: params.assignedByName || undefined,
        assignedByEmail: params.assignedByEmail, companyName: params.companyName, ticketUrl,
      }),
    })
  } catch (error) {
    console.error("Failed to send ticket assignment notification:", error)
    throw error
  }
}
