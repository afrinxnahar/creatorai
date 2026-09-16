"use client"

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Textarea } from "@repo/ui/textarea";
import AuthLayout from "@/components/auth/AuthLayout";
import { authKeyframes, AuthField, AuthSubmit } from "@/components/auth/AuthFields";

const formFields = [
  { name: "name", label: "Name", type: "text", placeholder: "Your name" },
  { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
] as const

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "", phone: "" })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      const response = await fetch("/api/contact-us", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error("Failed to send mail")

      await response.json()
      toast.success("Mail sent successfully!", {
        description: "Thank you for reaching out! We'll get back to you soon.",
      })
      setFormData({ name: "", email: "", message: "", phone: "" })
    } catch (error: any) {
      toast.error("Failed to send mail", {
        description: error?.message || "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }
  return (
    <AuthLayout
      tag="CONTACT"
      title="Tell us what you're building"
      subhead="Questions, feedback or ideas. The team reads every message and replies."
    >
      <style>{authKeyframes}</style>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {formFields.map((field) => (
          <AuthField
            key={field.name}
            label={field.label.toUpperCase()}
            id={field.name}
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            value={formData[field.name as keyof typeof formData]}
            onChange={handleChange}
            disabled={loading}
            required
          />
        ))}

        <label className="block">
          <span
            className="au-mono mb-2 block font-bold"
            style={{ fontSize: "10px", letterSpacing: ".18em", color: "rgba(18,21,26,.4)" }}
          >
            MESSAGE
          </span>
          <Textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={4}
            disabled={loading}
            placeholder="Write your message here..."
            className="au-input w-full resize-none bg-transparent px-0 shadow-none outline-none focus-visible:ring-0"
            style={{
              border: 0,
              borderBottom: "1.5px solid rgba(18,21,26,.2)",
              borderRadius: 0,
              color: "#12151A",
              fontSize: "16px",
              paddingBottom: 10,
              transition: "border-color .2s",
            }}
          />
        </label>

        <AuthSubmit loading={loading} loadingLabel="SENDING…">
          SEND MESSAGE
        </AuthSubmit>
      </form>

      <p className="mt-[22px]" style={{ fontSize: "12.5px", lineHeight: 1.6, color: "rgba(18,21,26,.5)" }}>
        Or email us directly at{" "}
        <a
          href="mailto:support@trycreatorai.com"
          className="font-bold no-underline"
          style={{ color: "#12151A", borderBottom: "2px solid #a855f7" }}
        >
          support@trycreatorai.com
        </a>
      </p>
    </AuthLayout>
  )
}
