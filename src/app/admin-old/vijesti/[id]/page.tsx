import { notFound } from "next/navigation"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsPostSources, newsItems, newsCategories } from "@/lib/db/schema/news"
import { eq } from "drizzle-orm"
import PostEditorClient from "./PostEditorClient"

export const dynamic = "force-dynamic"

async function getPost(id: string) {
  const posts = await drizzleDb.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)

  if (posts.length === 0) {
    return null
  }

  return posts[0]
}

async function getSourceItems(postId: string) {
  const sources = await drizzleDb
    .select({
      newsItem: newsItems,
    })
    .from(newsPostSources)
    .innerJoin(newsItems, eq(newsPostSources.newsItemId, newsItems.id))
    .where(eq(newsPostSources.postId, postId))

  return sources.map((s) => s.newsItem)
}

async function getCategories() {
  const categories = await drizzleDb.select().from(newsCategories).orderBy(newsCategories.sortOrder)

  // Build parent-child structure
  const parents = categories.filter((c) => !c.parentId)
  const children = categories.filter((c) => c.parentId)

  return parents.map((parent) => ({
    ...parent,
    children: children.filter((c) => c.parentId === parent.id),
  }))
}

export default async function PostEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [post, sourceItems, categories] = await Promise.all([
    getPost(id),
    getSourceItems(id),
    getCategories(),
  ])

  if (!post) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Uredi vijest</h2>
          <p className="text-sm text-[var(--muted)]">{post.title}</p>
        </div>
      </div>

      <PostEditorClient post={post} sourceItems={sourceItems} categories={categories} />
    </div>
  )
}
