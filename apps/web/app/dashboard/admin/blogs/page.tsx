"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAdminBlogs, adminApi } from "@/hooks/useAdmin"
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { auditPost } from "@/lib/blog-seo-rules"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/dialog"
import { toast } from "sonner"
import type { BlogPost } from "@repo/validation"

function renderSeo(blog: BlogPost) {
  if (!blog.focus_keyword) return <span className="text-xs text-slate-600">—</span>
  const { gaps } = auditPost({
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt ?? "",
    content: blog.content,
    seoTitle: blog.seo_title ?? "",
    seoDescription: blog.seo_description ?? "",
    focusKeyword: blog.focus_keyword,
    hasVideo: (blog.videos?.length ?? 0) > 0,
  })
  return gaps.length === 0 ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-400">
      pass
    </span>
  ) : (
    <span
      title={gaps.join("\n")}
      className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/40 text-amber-400 cursor-help"
    >
      {gaps.length} gap{gaps.length > 1 ? "s" : ""}
    </span>
  )
}

export default function AdminBlogsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const { data, total, loading, refresh } = useAdminBlogs(page, statusFilter)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const totalPages = Math.ceil((total || 0) / 20)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await adminApi.deleteBlog(deleteId)
      toast.success("Blog deleted")
      setDeleteId(null)
      refresh()
    } catch {
      toast.error("Failed to delete blog")
    }
  }

  const togglePublish = async (blog: BlogPost) => {
    try {
      const newStatus = blog.status === "published" ? "draft" : "published"
      await adminApi.updateBlog(blog.id, { status: newStatus })
      toast.success(newStatus === "published" ? "Blog published" : "Blog unpublished")
      refresh()
    } catch (err) {
      // Publishing can be refused by the database (missing SEO fields, or a focus
      // keyword another post already owns). That reason is worth showing.
      toast.error(err instanceof Error ? err.message : "Failed to update blog status")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Blog Posts</h1>
          <p className="text-slate-400 mt-1">Manage blog content</p>
        </div>
        <AdminButton onClick={() => router.push("/dashboard/admin/blogs/new")} variant="primary">
          <Plus className="h-4 w-4" />
          New Post
        </AdminButton>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Focus keyword</th>
                <th className="px-4 py-3 font-medium">SEO</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Featured</th>
                <th className="px-4 py-3 font-medium">Published</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No blog posts found</td>
                </tr>
              ) : (
                data?.map((blog) => (
                  <tr key={blog.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3 text-slate-200 max-w-xs truncate">{blog.title}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[12rem] truncate">
                      {blog.focus_keyword || <span className="text-slate-600">not set</span>}
                    </td>
                    <td className="px-4 py-3">{renderSeo(blog)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublish(blog)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${blog.status === "published"
                            ? "bg-green-900/40 text-green-400"
                            : blog.status === "draft"
                              ? "bg-yellow-900/40 text-yellow-400"
                              : "bg-slate-800 text-slate-400"
                          }`}
                      >
                        {blog.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{blog.featured ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {blog.published_at ? (
                        <span className="flex items-center gap-1.5">
                          {new Date(blog.published_at).toLocaleDateString()}
                          {new Date(blog.published_at).getTime() > Date.now() && (
                            <span
                              title="Future date: hidden from the blog until then"
                              className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-900/40 text-sky-400"
                            >
                              scheduled
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600">not published</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {blog.status === "published" && (
                          <a
                            href={`/blog/${blog.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View live"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-purple-400"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard/admin/blogs/${blog.id}`)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(blog.id)}
                          className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} posts</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </AdminButton>
            <span className="flex items-center text-sm text-slate-400 px-2">{page} / {totalPages}</span>
            <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader><DialogTitle>Delete Blog Post</DialogTitle></DialogHeader>
          <p className="text-slate-400">Are you sure? This will permanently delete this blog post.</p>
          <DialogFooter>
            <AdminButton variant="tertiary" onClick={() => setDeleteId(null)}>Cancel</AdminButton>
            <AdminButton variant="primary" tone="danger" onClick={handleDelete}>Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
