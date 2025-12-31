import { db } from "@/lib/db"
import { StaffManagementClient } from "./staff-management-client"

async function getStaffMembers() {
  return db.user.findMany({
    where: { systemRole: "STAFF" },
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
    orderBy: { createdAt: "desc" },
  })
}

export async function StaffManagement() {
  const staff = await getStaffMembers()

  return <StaffManagementClient staff={staff} />
}
