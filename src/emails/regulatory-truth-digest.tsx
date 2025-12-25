import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Heading,
  Preview,
} from "@react-email/components"
import React from "react"

export interface TruthHealthData {
  totalRules: number
  publishedRules: number
  publishedPercentage: number
  multiSourceRules: number
  singleSourceRules: number
  singleSourceBlocked: number
  singleSourceCanPublish: number
  duplicateGroups: number
  orphanedConcepts: number
  unlinkedPointerPercentage: number
}

export interface AlertItem {
  id: string
  type: string
  severity: "CRITICAL" | "WARNING" | "INFO"
  message: string
  occurredAt: Date
  occurrenceCount: number
}

export interface QueueHealth {
  name: string
  waiting: number
  active: number
  failed: number
  completed: number
}

export interface ConsolidatorResult {
  duplicateGroupsFound: number
  orphanedConceptsFound: number
  issuesResolved: number
}

export interface RegulatoryTruthDigestData {
  date: Date
  timezone: string
  truthHealth: TruthHealthData
  alerts: AlertItem[]
  queueHealth: QueueHealth[]
  consolidatorResult?: ConsolidatorResult
}

interface RegulatoryTruthDigestEmailProps {
  data: RegulatoryTruthDigestData
}

export default function RegulatoryTruthDigestEmail({ data }: RegulatoryTruthDigestEmailProps) {
  const dateStr = data.date.toLocaleDateString("hr-HR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const criticalAlerts = data.alerts.filter((a) => a.severity === "CRITICAL")
  const warningAlerts = data.alerts.filter((a) => a.severity === "WARNING")
  const overallStatus =
    criticalAlerts.length > 0 ? "CRITICAL" : warningAlerts.length > 0 ? "WARNING" : "HEALTHY"

  const statusColor =
    overallStatus === "CRITICAL" ? "#ef4444" : overallStatus === "WARNING" ? "#f59e0b" : "#10b981"

  const previewText = `[${overallStatus}] Regulatory Truth Daily Digest - ${data.truthHealth.publishedRules}/${data.truthHealth.totalRules} rules published`

  return (
    <Html lang="hr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section
            style={{
              ...styles.header,
              background: `linear-gradient(135deg, ${statusColor} 0%, #1e293b 100%)`,
            }}
          >
            <Heading style={styles.headerTitle}>Regulatory Truth Digest</Heading>
            <Text style={styles.headerSubtitle}>Daily Health Report</Text>
            <Text style={styles.headerDate}>{dateStr}</Text>
            <div
              style={{
                ...styles.statusBadge,
                backgroundColor:
                  statusColor === "#10b981" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)",
              }}
            >
              <Text style={styles.statusText}>{overallStatus}</Text>
            </div>
          </Section>

          <Section style={styles.content}>
            {/* Truth Health Snapshot */}
            <Section style={styles.section}>
              <Heading style={styles.sectionTitle}>Truth Health Snapshot</Heading>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Rules</Text>
                  <Text style={styles.statValue}>{data.truthHealth.totalRules}</Text>
                </div>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Published</Text>
                  <Text style={{ ...styles.statValue, color: "#10b981" }}>
                    {data.truthHealth.publishedRules} (
                    {data.truthHealth.publishedPercentage.toFixed(1)}%)
                  </Text>
                </div>
              </div>
            </Section>

            {/* Evidence Strength */}
            <Section style={styles.section}>
              <Heading style={styles.sectionTitle}>Evidence Strength</Heading>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Multi-Source Rules</Text>
                  <Text style={{ ...styles.statValue, color: "#10b981" }}>
                    {data.truthHealth.multiSourceRules}
                  </Text>
                  <Text style={styles.statNote}>Can publish immediately</Text>
                </div>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Single-Source Rules</Text>
                  <Text style={{ ...styles.statValue, color: "#f59e0b" }}>
                    {data.truthHealth.singleSourceRules}
                  </Text>
                  <Text style={styles.statNote}>
                    {data.truthHealth.singleSourceCanPublish} with LAW tier,{" "}
                    {data.truthHealth.singleSourceBlocked} blocked
                  </Text>
                </div>
              </div>
            </Section>

            {/* Data Quality */}
            <Section style={styles.section}>
              <Heading style={styles.sectionTitle}>Data Quality</Heading>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Duplicate Groups</Text>
                  <Text
                    style={{
                      ...styles.statValue,
                      color: data.truthHealth.duplicateGroups > 0 ? "#ef4444" : "#10b981",
                    }}
                  >
                    {data.truthHealth.duplicateGroups}
                  </Text>
                </div>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Orphaned Concepts</Text>
                  <Text
                    style={{
                      ...styles.statValue,
                      color: data.truthHealth.orphanedConcepts > 0 ? "#f59e0b" : "#10b981",
                    }}
                  >
                    {data.truthHealth.orphanedConcepts}
                  </Text>
                </div>
                <div style={styles.statCard}>
                  <Text style={styles.statLabel}>Unlinked Pointers</Text>
                  <Text style={styles.statValue}>
                    {data.truthHealth.unlinkedPointerPercentage.toFixed(1)}%
                  </Text>
                </div>
              </div>
            </Section>

            {/* Alerts */}
            {data.alerts.length > 0 ? (
              <Section style={styles.section}>
                <Heading style={{ ...styles.sectionTitle, borderBottomColor: statusColor }}>
                  Alerts (Last 24h): {data.alerts.length}
                </Heading>
                {criticalAlerts.length > 0 && (
                  <>
                    <Text style={styles.alertGroupTitle}>Critical ({criticalAlerts.length})</Text>
                    {criticalAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        style={{ ...styles.alertItem, borderLeftColor: "#ef4444" }}
                      >
                        <Text style={{ ...styles.alertType, color: "#ef4444" }}>{alert.type}</Text>
                        <Text style={styles.alertMessage}>{alert.message}</Text>
                        <Text style={styles.alertMeta}>
                          {alert.occurredAt.toLocaleTimeString("hr-HR")}
                          {alert.occurrenceCount > 1 && ` (${alert.occurrenceCount}x)`}
                        </Text>
                      </div>
                    ))}
                  </>
                )}
                {warningAlerts.length > 0 && (
                  <>
                    <Text style={styles.alertGroupTitle}>Warnings ({warningAlerts.length})</Text>
                    {warningAlerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        style={{ ...styles.alertItem, borderLeftColor: "#f59e0b" }}
                      >
                        <Text style={{ ...styles.alertType, color: "#f59e0b" }}>{alert.type}</Text>
                        <Text style={styles.alertMessage}>{alert.message}</Text>
                        <Text style={styles.alertMeta}>
                          {alert.occurredAt.toLocaleTimeString("hr-HR")}
                          {alert.occurrenceCount > 1 && ` (${alert.occurrenceCount}x)`}
                        </Text>
                      </div>
                    ))}
                    {warningAlerts.length > 5 && (
                      <Text style={styles.moreItems}>
                        ... and {warningAlerts.length - 5} more warnings
                      </Text>
                    )}
                  </>
                )}
              </Section>
            ) : (
              <Section style={styles.section}>
                <Heading style={{ ...styles.sectionTitle, borderBottomColor: "#10b981" }}>
                  Alerts (Last 24h)
                </Heading>
                <div style={styles.successBox}>
                  <Text style={styles.successText}>No alerts in the last 24 hours.</Text>
                </div>
              </Section>
            )}

            {/* Queue Health */}
            {data.queueHealth.length > 0 && (
              <Section style={styles.section}>
                <Heading style={styles.sectionTitle}>Queue Health</Heading>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Queue</th>
                      <th style={styles.th}>Waiting</th>
                      <th style={styles.th}>Active</th>
                      <th style={styles.th}>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queueHealth.map((queue) => (
                      <tr key={queue.name}>
                        <td style={styles.td}>{queue.name}</td>
                        <td style={styles.td}>{queue.waiting}</td>
                        <td style={styles.td}>{queue.active}</td>
                        <td
                          style={{ ...styles.td, color: queue.failed > 0 ? "#ef4444" : "#10b981" }}
                        >
                          {queue.failed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Consolidator Results */}
            {data.consolidatorResult && (
              <Section style={styles.section}>
                <Heading style={styles.sectionTitle}>Consolidator Check</Heading>
                <div style={styles.consolidatorCard}>
                  <Text style={styles.consolidatorItem}>
                    Duplicate Groups: {data.consolidatorResult.duplicateGroupsFound}
                  </Text>
                  <Text style={styles.consolidatorItem}>
                    Orphaned Concepts: {data.consolidatorResult.orphanedConceptsFound}
                  </Text>
                  <Text style={styles.consolidatorItem}>
                    Issues Resolved: {data.consolidatorResult.issuesResolved}
                  </Text>
                </div>
              </Section>
            )}

            {/* CTA */}
            <Section style={styles.ctaSection}>
              <Link href="https://admin.fiskai.hr/admin/watchdog" style={styles.ctaButton}>
                Open Watchdog Dashboard
              </Link>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>FiskAI Regulatory Truth Layer</Text>
            <Text style={styles.footerText}>
              Generated at 07:00 {data.timezone} by automated daily health check.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const styles = {
  body: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    backgroundColor: "#0f172a",
    margin: 0,
    padding: "20px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
  },
  header: {
    color: "white",
    padding: "30px",
    textAlign: "center" as const,
  },
  headerTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    color: "#ffffff",
  },
  headerSubtitle: {
    margin: "8px 0 0 0",
    opacity: 0.9,
    fontSize: "16px",
    color: "#ffffff",
  },
  headerDate: {
    margin: "5px 0 15px 0",
    opacity: 0.8,
    fontSize: "14px",
    color: "#ffffff",
  },
  statusBadge: {
    display: "inline-block",
    padding: "6px 16px",
    borderRadius: "20px",
    marginTop: "10px",
  },
  statusText: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: "1px",
    color: "#ffffff",
  },
  content: {
    padding: "30px",
  },
  section: {
    marginBottom: "30px",
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: "18px",
    margin: "0 0 15px 0",
    borderBottom: "2px solid #3b82f6",
    paddingBottom: "8px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  statCard: {
    backgroundColor: "#334155",
    padding: "15px",
    borderRadius: "8px",
  },
  statLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    margin: 0,
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#3b82f6",
    marginTop: "5px",
  },
  statNote: {
    fontSize: "11px",
    color: "#64748b",
    margin: "4px 0 0 0",
  },
  alertGroupTitle: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 600,
    margin: "12px 0 8px 0",
  },
  alertItem: {
    padding: "12px",
    borderLeft: "4px solid",
    backgroundColor: "#334155",
    marginBottom: "8px",
    borderRadius: "4px",
  },
  alertType: {
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    margin: 0,
  },
  alertMessage: {
    fontSize: "14px",
    color: "#e2e8f0",
    margin: "4px 0",
  },
  alertMeta: {
    fontSize: "11px",
    color: "#64748b",
    margin: 0,
  },
  moreItems: {
    color: "#64748b",
    fontSize: "13px",
    marginTop: "8px",
    fontStyle: "italic" as const,
  },
  successBox: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: "8px",
    padding: "16px",
    border: "1px solid rgba(16, 185, 129, 0.3)",
  },
  successText: {
    color: "#10b981",
    fontSize: "14px",
    margin: 0,
    textAlign: "center" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13px",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px",
    borderBottom: "1px solid #475569",
    color: "#94a3b8",
    fontSize: "11px",
    textTransform: "uppercase" as const,
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #334155",
    color: "#e2e8f0",
  },
  consolidatorCard: {
    backgroundColor: "#334155",
    padding: "15px",
    borderRadius: "8px",
  },
  consolidatorItem: {
    fontSize: "14px",
    color: "#e2e8f0",
    margin: "4px 0",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginTop: "30px",
    paddingTop: "30px",
    borderTop: "1px solid #334155",
  },
  ctaButton: {
    display: "inline-block",
    backgroundColor: "#3b82f6",
    color: "white",
    padding: "14px 28px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "16px",
  },
  footer: {
    backgroundColor: "#0f172a",
    padding: "20px",
    textAlign: "center" as const,
  },
  footerText: {
    color: "#64748b",
    fontSize: "12px",
    margin: "0 0 5px 0",
  },
}
