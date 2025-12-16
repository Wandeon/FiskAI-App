"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Save, Eye, X } from "lucide-react"
import type { NewsPost, NewsItem, NewsCategory } from "@/lib/db/schema/news"

interface PostEditorClientProps {
  post: NewsPost
  sourceItems: NewsItem[]
  categories: Array<NewsCategory & { children: NewsCategory[] }>
}

export default function PostEditorClient({ post, sourceItems, categories }: PostEditorClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt || "",
    categoryId: post.categoryId || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
    featuredImageUrl: post.featuredImageUrl || "",
    featuredImageSource: post.featuredImageSource || "",
    status: post.status,
    publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : "",
  })
  const [newTag, setNewTag] = useState("")
  const [expandedPasses, setExpandedPasses] = useState<Record<string, boolean>>({
    pass1: true,
    pass2: false,
    pass3: false,
  })

  const aiPasses = (post.aiPasses as any) || {}

  const handleSave = async (publish: boolean = false) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/news/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: publish ? "published" : formData.status,
          publishedAt: publish ? new Date().toISOString() : formData.publishedAt || null,
        }),
      })

      if (response.ok) {
        router.refresh()
        alert("Spremljeno!")
      } else {
        alert("Greška pri spremanju")
      }
    } catch (error) {
      console.error("Save error:", error)
      alert("Greška pri spremanju")
    } finally {
      setSaving(false)
    }
  }

  const handleRerunPass = async (pass: number) => {
    try {
      const response = await fetch(`/api/admin/news/posts/${post.id}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass }),
      })

      if (response.ok) {
        router.refresh()
        alert(`Pass ${pass} ponovno pokrenut!`)
      } else {
        alert("Greška")
      }
    } catch (error) {
      console.error("Rerun error:", error)
      alert("Greška")
    }
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    })
  }

  const addTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData({ ...formData, tags: [...formData.tags, newTag] })
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) })
  }

  // Get subcategories based on selected parent
  const selectedParent = categories.find((c) =>
    c.children.some((child) => child.id === formData.categoryId)
  )
  const parentCategory = selectedParent
    ? selectedParent.id
    : categories.find((c) => c.id === formData.categoryId)?.id || ""

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Editor (2/3 width) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card">
          <h3 className="mb-4 text-lg font-semibold">Uredi sadržaj</h3>

          {/* Title */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">Naslov</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </div>

          {/* Slug */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
            />
          </div>

          {/* Categories */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">
                Kategorija
              </label>
              <select
                value={parentCategory}
                onChange={(e) => {
                  const selectedCat = categories.find((c) => c.id === e.target.value)
                  if (selectedCat?.children.length === 0) {
                    setFormData({ ...formData, categoryId: e.target.value })
                  }
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="">Odaberi...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameHr}
                  </option>
                ))}
              </select>
            </div>
            {parentCategory && selectedParent && selectedParent.children.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">
                  Podkategorija
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="">Odaberi...</option>
                  {selectedParent.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.nameHr}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">Tagovi</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-[var(--surface-secondary)] px-2 py-1 text-xs font-semibold"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Novi tag..."
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
              <button
                onClick={addTag}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-secondary)]"
              >
                Dodaj
              </button>
            </div>
          </div>

          {/* Featured Image */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">
              Slika URL
            </label>
            <input
              type="text"
              value={formData.featuredImageUrl}
              onChange={(e) => setFormData({ ...formData, featuredImageUrl: e.target.value })}
              className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
            {formData.featuredImageUrl && (
              <img
                src={formData.featuredImageUrl}
                alt="Preview"
                className="mb-2 h-32 w-full rounded-lg object-cover"
              />
            )}
            <input
              type="text"
              value={formData.featuredImageSource}
              onChange={(e) => setFormData({ ...formData, featuredImageSource: e.target.value })}
              placeholder="Izvor slike (npr. Index.hr)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--muted)]"
            />
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">
              Sadržaj (Markdown)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={15}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
            />
          </div>

          {/* Excerpt */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">Sažetak</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </div>

          {/* Status & Publish Date */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="draft">Draft</option>
                <option value="reviewing">Reviewing</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--muted)]">
                Datum objave
              </label>
              <input
                type="datetime-local"
                value={formData.publishedAt}
                onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface)]"
            >
              <Save className="h-4 w-4" />
              {saving ? "Spremanje..." : "Spremi kao Draft"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Eye className="h-4 w-4" />
              Objavi sada
            </button>
          </div>
        </div>

        {/* Source Material */}
        {sourceItems.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card">
            <h3 className="mb-4 text-lg font-semibold">Izvorni materijal</h3>
            <div className="space-y-4">
              {sourceItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
                >
                  <h4 className="mb-2 font-semibold">{item.originalTitle}</h4>
                  <p className="mb-2 text-sm text-[var(--muted)]">
                    {item.originalContent?.slice(0, 300)}...
                  </p>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {item.sourceUrl}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: AI Passes Panel (1/3 width) */}
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card">
          <h3 className="mb-4 text-lg font-semibold">AI Prolazi</h3>

          {/* Pass 1: Write */}
          <AIPassAccordion
            title="Pass 1: Write"
            timestamp={aiPasses.pass1?.timestamp}
            expanded={expandedPasses.pass1}
            onToggle={() => setExpandedPasses({ ...expandedPasses, pass1: !expandedPasses.pass1 })}
            onRerun={() => handleRerunPass(1)}
          >
            {aiPasses.pass1?.content && (
              <div className="text-sm text-[var(--muted)]">
                <pre className="whitespace-pre-wrap">{aiPasses.pass1.content.slice(0, 500)}...</pre>
              </div>
            )}
            {aiPasses.pass1?.classification && (
              <div className="mt-2 text-xs">
                <strong>Impact:</strong> {aiPasses.pass1.classification.impact}
                <br />
                <strong>Reasoning:</strong> {aiPasses.pass1.classification.reasoning}
              </div>
            )}
          </AIPassAccordion>

          {/* Pass 2: Review */}
          <AIPassAccordion
            title="Pass 2: Review"
            timestamp={aiPasses.pass2?.timestamp}
            expanded={expandedPasses.pass2}
            onToggle={() => setExpandedPasses({ ...expandedPasses, pass2: !expandedPasses.pass2 })}
            onRerun={() => handleRerunPass(2)}
          >
            {aiPasses.pass2 && (
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Score:</strong> {aiPasses.pass2.score}/10
                </div>
                {aiPasses.pass2.problems?.length > 0 && (
                  <div>
                    <strong>Problems:</strong>
                    <ul className="ml-4 list-disc text-xs text-[var(--muted)]">
                      {aiPasses.pass2.problems.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiPasses.pass2.suggestions?.length > 0 && (
                  <div>
                    <strong>Suggestions:</strong>
                    <ul className="ml-4 list-disc text-xs text-[var(--muted)]">
                      {aiPasses.pass2.suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </AIPassAccordion>

          {/* Pass 3: Rewrite */}
          <AIPassAccordion
            title="Pass 3: Rewrite"
            timestamp={aiPasses.pass3?.timestamp}
            expanded={expandedPasses.pass3}
            onToggle={() => setExpandedPasses({ ...expandedPasses, pass3: !expandedPasses.pass3 })}
            onRerun={() => handleRerunPass(3)}
          >
            {aiPasses.pass3?.content && (
              <div className="text-sm text-[var(--muted)]">
                <pre className="whitespace-pre-wrap">{aiPasses.pass3.content.slice(0, 500)}...</pre>
              </div>
            )}
          </AIPassAccordion>
        </div>
      </div>
    </div>
  )
}

function AIPassAccordion({
  title,
  timestamp,
  expanded,
  onToggle,
  onRerun,
  children,
}: {
  title: string
  timestamp?: string
  expanded: boolean
  onToggle: () => void
  onRerun: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)]">
      <div className="flex items-center justify-between p-3">
        <button onClick={onToggle} className="flex flex-1 items-center gap-2">
          <div className="text-sm font-semibold">{title}</div>
          {timestamp && (
            <div className="text-xs text-[var(--muted)]">
              {new Date(timestamp).toLocaleString("hr-HR")}
            </div>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-[var(--border)] p-3">
          {children}
          <button
            onClick={onRerun}
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-secondary)]"
          >
            Re-run {title}
          </button>
        </div>
      )}
    </div>
  )
}
