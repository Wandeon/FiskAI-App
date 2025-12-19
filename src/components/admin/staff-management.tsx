import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, Plus, Search } from 'lucide-react'

async function getStaffMembers() {
  return db.user.findMany({
    where: { systemRole: 'STAFF' },
    include: {
      _count: {
        select: {
          staffAssignments: true,
        },
      },
      staffAssignments: {
        include: {
          company: {
            select: { name: true },
          },
        },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function StaffManagement() {
  const staff = await getStaffMembers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">
            {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search staff..."
              className="pl-9 w-64"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No staff members yet</p>
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add First Staff Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {staff.map((member) => (
            <Card key={member.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{member.name || 'Unnamed'}</h3>
                    <Badge variant="outline">Staff</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {member._count.staffAssignments} clients
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.staffAssignments.slice(0, 2).map(a => a.company.name).join(', ')}
                      {member._count.staffAssignments > 2 && '...'}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
