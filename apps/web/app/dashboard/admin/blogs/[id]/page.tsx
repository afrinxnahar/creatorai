"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { adminApi } from "@/hooks/useAdmin"
import { toast } from "sonner"
import { ExternalLink } from "lucide-react"
import { BlogPostForm, formFromPost, type BlogFormState } from "@/components/admin/blog-post-form"

export default function EditBlogPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [initial, setInitial] = useState<BlogFormState | null>(null)
  const [status, setStatus] = useState<string>("draft")
  const [slug, setSlug] = useState<string>("")

  useEffect(() => {
    ;(async () => {
      try {
        const blog = await adminApi.getBlog(id)
        setInitial(formFromPost(blog))
        setStatus(blog.status)
        setSlug(blog.slug)
      } catch {
        toast.error("Failed to load blog post")
        router.push("/dashboard/admin/blogs")
      }
    })()
  }, [id, router])

  if (!initial) {
    return <div className="text-slate-400">Loading...</div>
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Edit Blog Post</h1>
          <p className="text-slate-400 mt-1">
            Changes go live on the next revalidation, within an hour.
          </p>
        </div>
        {status === "published" && (
          <Link
            href={`/blog/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 shrink-0"
          >
            View live <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <BlogPostForm
        initial={initial}
        submitLabel="Save Changes"
        onSubmit={async (payload) => {
          try {
            await adminApi.updateBlog(id, payload)
            toast.success("Blog post updated")
            router.push("/dashboard/admin/blogs")
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update blog post")
          }
        }}
      />
    </div>
  )
}
