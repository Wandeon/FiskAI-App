export type NotificationType = "success" | "warning" | "info"

export interface NotificationActionLink {
  label: string
  href: string
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  description?: string
  timestamp?: string
  rawTimestamp?: string
  action?: NotificationActionLink
}
