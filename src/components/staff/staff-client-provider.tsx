"use client"

// Re-export the actual StaffClientProvider from the contexts folder
// This maintains backward compatibility with existing imports while using the real implementation
export { StaffClientProvider, useStaffClient } from "@/contexts/staff-client-context"
