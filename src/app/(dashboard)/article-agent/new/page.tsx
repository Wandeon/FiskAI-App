// src/app/(dashboard)/article-agent/new/page.tsx

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createJob, startJob } from "@/app/actions/article-agent"
import type { ArticleType } from "@prisma/client"

const ARTICLE_TYPES: { value: ArticleType; label: string }[] = [
  { value: "NEWS", label: "Vijest" },
  { value: "GUIDE", label: "Vodič" },
  { value: "HOWTO", label: "Kako da..." },
  { value: "GLOSSARY", label: "Rječnik" },
  { value: "COMPARISON", label: "Usporedba" },
]

export default function NewJobPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<ArticleType>("NEWS")
  const [topic, setTopic] = useState("")
  const [urls, setUrls] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const sourceUrls = urls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"))

      if (sourceUrls.length === 0) {
        alert("Unesite barem jedan URL izvor")
        return
      }

      const result = await createJob({
        type,
        sourceUrls,
        topic: topic || undefined,
      })

      if (result.success && result.data) {
        // Start the job
        await startJob(result.data.jobId)
        router.push(`/article-agent/${result.data.jobId}`)
      }
    } catch (error) {
      console.error("Failed to create job:", error)
      alert("Greška pri kreiranju posla")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Novi članak</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="type">Tip članka</Label>
          <Select value={type} onValueChange={(v) => setType(v as ArticleType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARTICLE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Tema (opcionalno)</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="npr. Novi PDV pragovi 2025"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="urls">URL izvori (jedan po liniji)</Label>
          <Textarea
            id="urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://porezna-uprava.hr/..."
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            Unesite URL-ove izvora iz kojih će se generirati članak
          </p>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Kreiram..." : "Kreiraj i pokreni"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
