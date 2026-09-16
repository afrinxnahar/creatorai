"use client"

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "sonner";
import { loginUserSchema } from "@repo/validation";
import { ZodError } from "zod";
import AuthLayout from "@/components/auth/AuthLayout";
import {
  authKeyframes,
  AuthField,
  AuthSubmit,
  GoogleButton,
  AuthFootLine,
  AuthFootLink,
} from "@/components/auth/AuthFields";

function isZodError(error: unknown): error is ZodError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ZodError' &&
    'errors' in error &&
    Array.isArray((error as any).errors)
  );
}

//Define a type for the form state for better type safety.
type FormState = Record<"email" | "password", string>
type ErrorState = Partial<FormState>

export default function LoginPage() {
  // Initializing state with a more specific type.
  const [details, setDetails] = useState<FormState>({ email: "", password: "" })
  //  Added state to hold and display validation errors.
  const [errors, setErrors] = useState<ErrorState>({})
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const { supabase, user, profile, profileLoading } = useSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get("redirectTo") || searchParams.get("redirectedFrom")
  const redirectTo = rawRedirect?.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : null

  useEffect(() => {
    if (user && !profileLoading && profile) {
      if (profile.role === "admin") {
        router.replace("/admin/login")
        return
      }
      if (redirectTo) {
        router.replace(redirectTo)
      } else {
        router.replace("/dashboard")
      }
    }
  }, [user, profile, profileLoading, router, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return // auth client still code-splitting in
    // Clear previous errors on a new submission attempt.
    setErrors({})
    setLoading(true)

    try {
      // Validate form data before sending it to the server
      loginUserSchema.parse(details)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: details.email,
        password: details.password,
      })

      if (error) {
        throw new Error(error.message) // Centralize error handling in the catch block
      }

      if (data.user) {
        toast.success("You have been successfully logged in.")

        if (redirectTo) {
          router.push(redirectTo)
          return
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single()

        const role = profileData?.role
        if (role === "admin") {
          await supabase.auth.signOut()
          toast.error("Access Denied", { description: "Admins must use the admin login portal." })
          return
        }
        router.push("/dashboard")
      }
    } catch (error: any) {
      if (isZodError(error)) {
        // Map Zod errors to our state format
        const fieldErrors: ErrorState = {}
        error.errors.forEach(err => {
          if (err.path[0] === "email" || err.path[0] === "password") {
            fieldErrors[err.path[0] as keyof ErrorState] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle Supabase auth errors or other unexpected errors
        // console.error("Login error:", error)
        toast.error("Login Failed", {
          description: error.message || "An unexpected error occurred. Please try again.",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!supabase) return // auth client still code-splitting in
    try {
      const callbackUrl = new URL("/api/auth/callback", window.location.origin)
      if (redirectTo) callbackUrl.searchParams.set("next", redirectTo)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      })

      if (error) throw error
    } catch (error: any) {
      toast.error("Google Login Failed", {
        description: error.message || "Could not sign in with Google. Please try again.",
      })
    }
  }

  // Only an already-signed-in visitor gets held back, and they get a real
  // pending screen instead of the blank `return null` that read as a freeze.
  // The form itself never waits on auth: the Supabase client is a deferred
  // import, so gating on its loading flag would leave the page stuck behind
  // any slow or unreachable auth call.
  if (user) return null

  return (
    <AuthLayout
      tag="SIGN IN"
      title="Your whole pipeline, still warm"
      subhead="Ideas, scripts, subtitles, dubs and thumbnails, right where you left them."
    >
      <style>{authKeyframes}</style>

      <form onSubmit={handleLogin} className="flex flex-col gap-6">
        <AuthField
          label="EMAIL"
          id="email"
          type="email"
          placeholder="you@channel.com"
          value={details.email}
          onChange={(e) => setDetails({ ...details, email: e.target.value })}
          error={errors.email}
          disabled={loading}
          required
        />

        <AuthField
          label="PASSWORD"
          id="password"
          type="password"
          placeholder="••••••••••"
          value={details.password}
          onChange={(e) => setDetails({ ...details, password: e.target.value })}
          error={errors.password}
          shake={!!errors.password}
          disabled={loading}
          required
          labelAction={
            <Link
              href="/forgot-password"
              className="au-mono font-bold no-underline"
              style={{ color: "#2563eb", letterSpacing: ".06em" }}
            >
              RESET
            </Link>
          }
        />

        <AuthSubmit loading={loading} loadingLabel="SIGNING YOU IN…">
          LOG IN
        </AuthSubmit>
      </form>

      <GoogleButton onClick={handleGoogleLogin} />

      <AuthFootLine>
        First time here?{" "}
        <AuthFootLink href="/signup">Create one free</AuthFootLink>
      </AuthFootLine>
    </AuthLayout>
  )
}
