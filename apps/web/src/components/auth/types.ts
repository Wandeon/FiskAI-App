export type AuthStep = "identify" | "authenticate" | "register" | "verify" | "reset" | "success"

export interface AuthFlowState {
  step: AuthStep
  email: string
  name: string
  systemRole?: "USER" | "STAFF" | "ADMIN"
  isNewUser: boolean
  hasPasskey: boolean
  error: string | null
  isLoading: boolean
}

export interface UserInfo {
  exists: boolean
  emailVerified?: boolean
  hasPasskey?: boolean
  name?: string
  systemRole?: "USER" | "STAFF" | "ADMIN"
  error?: string
}
