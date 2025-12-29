import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InvitationForm } from "@/components/staff/invitation-form"

export default function NewInvitationPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Invite New Client</CardTitle>
          <CardDescription>
            Send an invitation email to a potential client. They will be able to register
            and their account will be automatically assigned to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationForm />
        </CardContent>
      </Card>
    </div>
  )
}
