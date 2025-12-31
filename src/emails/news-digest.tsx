import { Html, Head, Body, Container, Section, Text, Link, Heading } from "@react-email/components"
import React from "react"

export interface NewsDigestPost {
  slug: string
  title: string
  excerpt: string
  categoryName: string | null
  publishedAt: Date | null
}

interface NewsDigestEmailProps {
  posts: NewsDigestPost[]
  unsubscribeToken?: string
}

export default function NewsDigestEmail({ posts, unsubscribeToken }: NewsDigestEmailProps) {
  const today = new Date().toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Html lang="hr">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>FiskAI Vijesti</Heading>
            <Text style={styles.headerSubtitle}>
              Najnovije vijesti iz svijeta poreza i fiskalizacije
            </Text>
            <Text style={styles.headerDate}>{today}</Text>
          </Section>

          {/* Content */}
          <Section style={styles.content}>
            {posts.length === 0 ? (
              <Section style={styles.section}>
                <Text style={styles.emptyState}>Nema novih vijesti danas.</Text>
              </Section>
            ) : (
              <>
                {posts.map((post) => (
                  <Section key={post.slug} style={styles.postCard}>
                    {post.categoryName && (
                      <Text style={styles.categoryBadge}>{post.categoryName}</Text>
                    )}
                    <Heading style={styles.postTitle}>
                      <Link href={`https://fiskai.hr/vijesti/${post.slug}`} style={styles.postLink}>
                        {post.title}
                      </Link>
                    </Heading>
                    {post.excerpt && <Text style={styles.postExcerpt}>{post.excerpt}</Text>}
                    <Link
                      href={`https://fiskai.hr/vijesti/${post.slug}`}
                      style={styles.readMoreLink}
                    >
                      Čitaj više →
                    </Link>
                  </Section>
                ))}
              </>
            )}

            {/* CTA Section */}
            <Section style={styles.ctaSection}>
              <Link href="https://fiskai.hr/vijesti" style={styles.ctaButton}>
                Sve vijesti
              </Link>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>FiskAI - Fiskalizacija pojednostavljena</Text>
            <Text style={styles.footerText}>
              Primili ste ovu poruku jer ste pretplaćeni na FiskAI newsletter.
            </Text>
            {unsubscribeToken && (
              <Text style={styles.footerText}>
                <Link
                  href={`https://fiskai.hr/api/newsletter/unsubscribe?token=${unsubscribeToken}`}
                  style={styles.unsubscribeLink}
                >
                  Odjavi se
                </Link>
              </Text>
            )}
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
    backgroundColor: "#f5f5f5",
    margin: 0,
    padding: "20px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "30px",
    textAlign: "center" as const,
  },
  headerTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 600,
  },
  headerSubtitle: {
    margin: "10px 0 0 0",
    opacity: 0.9,
    fontSize: "16px",
  },
  headerDate: {
    margin: "5px 0 0 0",
    opacity: 0.8,
    fontSize: "14px",
  },
  content: {
    padding: "30px",
  },
  section: {
    marginBottom: "20px",
  },
  emptyState: {
    color: "#666",
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    margin: "20px 0",
  },
  postCard: {
    marginBottom: "30px",
    paddingBottom: "25px",
    borderBottom: "1px solid #e5e7eb",
  },
  categoryBadge: {
    display: "inline-block",
    backgroundColor: "#ede9fe",
    color: "#5b21b6",
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "10px",
  },
  postTitle: {
    color: "#333",
    fontSize: "22px",
    margin: "10px 0",
    lineHeight: "1.4",
  },
  postLink: {
    color: "#333",
    textDecoration: "none",
  },
  postExcerpt: {
    color: "#666",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "10px 0",
  },
  readMoreLink: {
    color: "#667eea",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginTop: "30px",
    paddingTop: "30px",
    borderTop: "1px solid #e5e7eb",
  },
  ctaButton: {
    display: "inline-block",
    backgroundColor: "#667eea",
    color: "white",
    padding: "14px 28px",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "16px",
  },
  footer: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    textAlign: "center" as const,
  },
  footerText: {
    color: "#666",
    fontSize: "13px",
    margin: "0 0 5px 0",
  },
  unsubscribeLink: {
    color: "#999",
    textDecoration: "underline",
  },
}
