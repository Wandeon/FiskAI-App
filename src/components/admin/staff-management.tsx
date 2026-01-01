import { StaffManagementClient } from "./staff-management-client"
import { getStaffMembers } from "@/lib/admin/queries"

// TODO: Database queries moved to @/lib/admin/queries for Clean Architecture compliance

export async function StaffManagement() {
  const staff = await getStaffMembers()

  return <StaffManagementClient staff={staff} />
}
