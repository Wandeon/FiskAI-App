"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Search, Mail, Calendar, Building2 } from "lucide-react"

interface StaffAssignment {
  company: {
    name: string
  }
}

interface StaffMember {
  id: string
  email: string
  name: string | null
  createdAt: Date
  _count: {
    staffAssignments: number
  }
  staffAssignments: StaffAssignment[]
}

interface StaffManagementClientProps {
  staff: StaffMember[]
}

export function StaffManagementClient({ staff }: StaffManagementClientProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStaff = staff.filter((member) => {
    const query = searchQuery.toLowerCase()
    return (
      member.email.toLowerCase().includes(query) ||
      (member.name?.toLowerCase().includes(query) ?? false)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage staff members and their client assignments</p>
        </div>
        <Button disabled title="Feature coming soon">
          <Users className="mr-2 h-4 w-4" />
          Add Staff Member
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staff.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">With Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {staff.filter((s) => s._count.staffAssignments > 0).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {staff.filter((s) => s._count.staffAssignments === 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Staff Members ({filteredStaff.length})</span>
            {filteredStaff.length !== staff.length && (
              <Badge variant="secondary">Filtered from {staff.length} total</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStaff.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {staff.length === 0 ? "No staff members found" : "No staff match the search criteria"}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStaff.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.name || "Unnamed"}</span>
                      <Badge variant="outline">
                        {member._count.staffAssignments} client
                        {member._count.staffAssignments !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {new Date(member.createdAt).toLocaleDateString("hr-HR")}
                      </span>
                    </div>
                    {member.staffAssignments.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Clients:</span>
                        {member.staffAssignments.map((assignment, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {assignment.company.name}
                          </Badge>
                        ))}
                        {member._count.staffAssignments > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{member._count.staffAssignments - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" disabled title="Feature coming soon">
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
