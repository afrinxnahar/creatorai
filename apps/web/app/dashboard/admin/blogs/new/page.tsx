"use client"

import { useRouter } from "next/navigation"
import { adminApi } from "@/hooks/useAdmin"
import { toast } from "sonner"
import { BlogPostForm, EMPTY_FORM } from "@/components/admin/blog-post-form"

export default function NewBlogPage() {
  const router = useRouter()

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">New Blog Post</h1>
        <p className="text-slate-400 mt-1">
          Drafts save with anything filled in. Publishing requires the search fields.
        </p>
      </div>

      <BlogPostForm
        initial={EMPTY_FORM}
        submitLabel="Create Post"
        onSubmit={async (payload) => {
          try {
            await adminApi.createBlog(payload)
            toast.success("Blog post created")
            router.push("/dashboard/admin/blogs")
          } catch (err) {
            // The database rejects a publish that skips the SEO contract or
            // reuses a focus keyword. Surfacing its message beats "failed".
            toast.error(err instanceof Error ? err.message : "Failed to create blog post")
          }
        }}
      />
    </div>
  )
}
