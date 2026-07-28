"use client"

import Link from "next/link"
import { Button } from "@repo/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog"
import { CreditCard, ArrowRight } from "lucide-react"

interface OutOfCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The message from the job that failed, e.g. how many credits the run needed. */
  description: string
}

export function OutOfCreditsDialog({ open, onOpenChange, description }: OutOfCreditsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <CreditCard className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            You&apos;re out of credits
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            asChild
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Link href="/dashboard/settings?tab=billing" onClick={() => onOpenChange(false)}>
              Get more credits
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
