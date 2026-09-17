"use client"

import { useState, useEffect } from "react"
import { marked } from "marked"
import { Send, Loader2 } from "lucide-react"
import { Input } from "@repo/ui/input"
import { Textarea } from "@repo/ui/textarea"
import { toast } from "sonner"
import { AdminButton } from "./admin-button"

interface ReplyComposerProps {
  /** Recipient address, shown on the send button and in the success toast. */
  to: string
  defaultSubject: string
  /** Receives the subject and the reply body already rendered to HTML. */
  send: (subject: string, html: string) => Promise<unknown>
  onSent?: () => void
  rows?: number
}

export function ReplyComposer({ to, defaultSubject, send, onSent, rows = 10 }: ReplyComposerProps) {
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => { setSubject(defaultSubject) }, [defaultSubject])

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!body.trim()) {
      toast.error("Write a reply first")
      return
    }
    setSending(true)
    try {
      await send(subject, await marked.parse(body))
      toast.success(`Reply sent to ${to}`)
      setBody("")
      onSent?.()
    } catch {
      toast.error("Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wide text-slate-500">Subject</label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-slate-800 border-slate-700 text-slate-100"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wide text-slate-500">Message</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={rows}
          placeholder="Write your reply… Markdown supported (**bold**, [links](https://…), lists)."
          className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-sm"
        />
        <p className="text-xs text-slate-500">Markdown is rendered to HTML before sending via Resend.</p>
      </div>
      <div className="flex justify-end">
        <AdminButton variant="primary" onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Send reply to {to}
        </AdminButton>
      </div>
    </div>
  )
}
