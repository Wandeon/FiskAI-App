import { Html, Head, Body, Container, Section, Text, Link, Heading } from "@react-email/components"
import React from "react"

interface AIQualityDigestProps {
  data: {
    weekStart: Date
    weekEnd: Date
    globalStats: {
      total: number
      correct: number
      incorrect: number
      partial: number
      accuracy: number
    }
    byOperation: Record<string, any>
    lowAccuracyCompanies: any[]
    recentCorrections: any[]
    improvementSuggestions: string[]
  }
}

export default function AIQualityDigest({ data }: AIQualityDigestProps) {
  const weekStartStr = data.weekStart.toLocaleDateString("hr-HR")
  const weekEndStr = data.weekEnd.toLocaleDateString("hr-HR")

  return (
    <Html lang="hr">
      <Head />
      <Body
        style={{
          fontFamily: "sans-serif",
          backgroundColor: "#f5f5f5",
          padding: "20px",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "#fff",
            borderRadius: "8px",
            padding: "30px",
          }}
        >
          <Heading>AI Quality Digest</Heading>
          <Text>
            Tjedni pregled: {weekStartStr} - {weekEndStr}
          </Text>
          <Section>
            <Heading as="h2">📊 Globalna statistika</Heading>
            <Text>Ukupno: {data.globalStats.total}</Text>
            <Text>Točnost: {data.globalStats.accuracy}%</Text>
            <Text>Točno: {data.globalStats.correct}</Text>
            <Text>Netočno: {data.globalStats.incorrect}</Text>
          </Section>
          {data.improvementSuggestions.length > 0 && (
            <Section>
              <Heading as="h2">💡 Prijedlozi za poboljšanje</Heading>
              {data.improvementSuggestions.map((suggestion: string, index: number) => (
                <Text key={index}>• {suggestion}</Text>
              ))}
            </Section>
          )}
          <Link href="https://admin.fiskai.hr/dashboard">Otvori Admin Dashboard</Link>
        </Container>
      </Body>
    </Html>
  )
}
