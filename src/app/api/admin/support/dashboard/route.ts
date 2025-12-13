// src/app/api/admin/support/dashboard/route.ts
// Admin support dashboard API for operations

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isGlobalAdmin } from "@/lib/admin";
import { cookies } from "next/headers";
import { SupportTicketStatus, SupportTicketPriority } from "@prisma/client";

interface SupportDashboardData {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  byPriority: Record<SupportTicketPriority, number>;
  byStatus: Record<SupportTicketStatus, number>;
  averageResolutionTime: number | null; // in hours
  oldestOpenTicket: string | null; // ticket ID
  companiesWithOpenTickets: number;
  recentActivity: Array<{
    ticketId: string;
    title: string;
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    company: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("fiskai_admin_auth");
  
  if (!isGlobalAdmin(adminCookie?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get all tickets with company info
    const allTickets = await db.supportTicket.findMany({
      include: {
        company: {
          select: { name: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 50, // Get recent tickets for activity feed
    });

    // Calculate metrics
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => t.status === SupportTicketStatus.OPEN).length;
    const inProgressTickets = allTickets.filter(t => t.status === SupportTicketStatus.IN_PROGRESS).length;
    const resolvedTickets = allTickets.filter(t => t.status === SupportTicketStatus.RESOLVED).length;
    const closedTickets = allTickets.filter(t => t.status === SupportTicketStatus.CLOSED).length;

    // Count by priority
    const byPriority: Record<SupportTicketPriority, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      URGENT: 0,
    };
    
    allTickets.forEach(ticket => {
      byPriority[ticket.priority]++;
    });

    // Count by status
    const byStatus: Record<SupportTicketStatus, number> = {
      OPEN: openTickets,
      IN_PROGRESS: inProgressTickets,
      RESOLVED: resolvedTickets,
      CLOSED: closedTickets,
    };

    // Calculate average resolution time (for resolved tickets)
    // NOTE: resolvedAt field doesn't exist in schema, so we're skipping this calculation
    const averageResolutionTime: number | null = null;

    // Find oldest open ticket
    const openTicketsSorted = allTickets
      .filter(t => t.status === SupportTicketStatus.OPEN)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    const oldestOpenTicket = openTicketsSorted.length > 0 ? openTicketsSorted[0].id : null;

    // Count unique companies with open tickets
    const companiesWithOpenTickets = new Set(
      allTickets
        .filter(t => t.status === SupportTicketStatus.OPEN)
        .map(t => t.companyId)
    ).size;

    // Recent activity (last 10 updated tickets)
    const recentActivity = allTickets.slice(0, 10).map(ticket => ({
      ticketId: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      company: ticket.company.name,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }));

    const dashboardData: SupportDashboardData = {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      byPriority,
      byStatus,
      averageResolutionTime: averageResolutionTime ? Math.round(averageResolutionTime * 100) / 100 : null,
      oldestOpenTicket,
      companiesWithOpenTickets,
      recentActivity,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Admin support dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch support dashboard data" },
      { status: 500 }
    );
  }
}