"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DubbedResult, DubbingProgress, supportedLanguages } from "@repo/validation";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { useSupabase } from "@/components/supabase-provider";
import { BACKEND_URL } from "@/lib/constants";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

// BullMQ SSE state → the UI's DubbingProgress state.
function mapState(state: string): DubbingProgress["state"] {
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  return "processing"; // waiting | active
}

// Read duration client-side — the API needs it to price the job (credits/sec).
function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      // Header-less VBR/WebM reports Infinity, which JSON.stringify sends as null and
      // the API then rejects as a missing duration — catch it here with a message that
      // says what to do about it.
      if (!Number.isFinite(el.duration) || el.duration <= 0) {
        reject(new Error("Could not read this file's length. Try re-exporting it as MP3 or MP4."));
        return;
      }
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      reject(new Error("Could not read media metadata. The file may be corrupt."));
    };
    el.src = URL.createObjectURL(file);
  });
}

export function useDubbing() {
  const { session } = useSupabase();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  // Measured once, when the file is picked — so the plan cap is enforced before the
  // user fills in the rest of the form, not after they press Dub.
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [targetAccent, setTargetAccent] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [dubbedResult, setDubbedResult] = useState<DubbedResult | null>(null);

  const [allowed, setAllowed] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  // null = no limit (paid plans). Starter is capped rather than locked out.
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number | null>(null);

  // Mid-run cancellation: the BullMQ job id of the in-flight dub, and whether the
  // user asked to cancel (suppresses the generic failure toast).
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const cancelRequestedRef = useRef(false);

  const [progress, setProgress] = useState<DubbingProgress>({
    state: "idle",
    progress: 0,
    message: "",
  });

  // Every plan can dub; Starter is limited on clip length instead.
  useEffect(() => {
    api
      .get<{ allowed: boolean; maxDurationSeconds: number | null }>("/api/v1/dubbing/access", {
        requireAuth: true,
      })
      .then((res) => {
        setAllowed(!!res.allowed);
        setMaxDurationSeconds(res.maxDurationSeconds ?? null);
      })
      .catch(() => setAllowed(false))
      .finally(() => setAccessLoading(false));
  }, []);

  const updateProgress = useCallback(
    (state: DubbingProgress["state"], value: number, message: string) => {
      setProgress({ state, progress: value, message });
    },
    [],
  );

  // Shared by the file input and the drag-and-drop zone.
  const handleFileSelect = useCallback(async (file: File | null | undefined) => {
    if (!file) return;

    if (!/^(audio|video)\//.test(file.type)) {
      toast.error("Unsupported file", { description: "Please upload an audio or video file." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File too large", { description: "Please upload a file smaller than 500MB." });
      return;
    }

    let duration: number;
    try {
      duration = await getMediaDuration(file);
    } catch (error) {
      toast.error("Unreadable file", {
        description: error instanceof Error ? error.message : "The file may be corrupt.",
      });
      return;
    }

    if (maxDurationSeconds !== null && duration > maxDurationSeconds) {
      toast.error(`Clip is too long for your plan`, {
        description: `Your plan dubs clips up to ${maxDurationSeconds}s. This one is ${Math.round(duration)}s — trim it, or upgrade for unlimited length.`,
      });
      return;
    }

    setIsVideo(file.type.startsWith("video/"));
    setMediaFile(file);
    setMediaDuration(duration);
    setDubbedResult(null);
    setProgress({ state: "idle", progress: 0, message: "" });
  }, [maxDurationSeconds]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileSelect(e.target.files?.[0]);
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-selecting the same file
  }, [handleFileSelect]);

  const resetForm = useCallback(() => {
    setMediaFile(null);
    setMediaDuration(null);
    setTargetLanguage("");
    setTargetAccent("");
    setMediaName("");
    setDubbedResult(null);
    setProgress({ state: "idle", progress: 0, message: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDubMedia = useCallback(async () => {
    if (!mediaFile || !targetLanguage || !mediaName.trim()) {
      if (!mediaFile) toast.error("No file uploaded");
      if (!targetLanguage) toast.error("No target language selected");
      if (!mediaName.trim()) toast.error("Please enter a name for your media");
      return;
    }

    let eventSource: EventSource | null = null;

    try {
      // Measured at file-select; re-read only if that somehow did not stick.
      const durationSeconds = mediaDuration ?? (await getMediaDuration(mediaFile));

      // Fail before the upload rather than after it — the server enforces this too,
      // this just saves the user pushing a file to GCS that will be rejected.
      if (maxDurationSeconds !== null && durationSeconds > maxDurationSeconds) {
        throw new Error(
          `Your plan can dub clips up to ${maxDurationSeconds} seconds. This one is ${Math.round(durationSeconds)}s — trim it, or upgrade for unlimited length.`,
        );
      }

      // 1. Signed URL — plan-gated + size-checked server-side before it's issued.
      updateProgress("uploading", 5, "Preparing upload...");
      const { uploadUrl, objectName, contentType } = await api.post<{
        uploadUrl: string;
        objectName: string;
        contentType: string;
      }>(
        "/api/v1/dubbing/sign-upload",
        {
          filename: mediaFile.name,
          contentType: mediaFile.type || (isVideo ? "video/mp4" : "audio/mpeg"),
          fileSize: mediaFile.size,
          isVideo,
          durationSeconds,
        },
        { requireAuth: true, accessToken: session?.access_token },
      );

      // 2. Upload straight to GCS (no API in the byte path).
      await axios.put(uploadUrl, mediaFile, {
        headers: { "Content-Type": contentType },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / (e.total || 1));
          updateProgress("uploading", Math.min(15, 5 + pct * 0.1), `Uploading media... ${pct}%`);
        },
      });

      // 3. Create the dubbing job.
      updateProgress("processing", 15, "Upload complete. Starting dubbing...");
      const { jobId } = await api.post<{ projectId: string; jobId: string }>(
        "/api/v1/dubbing",
        { objectName, targetLanguage, targetAccent: targetAccent || undefined, isVideo, mediaName: mediaName.trim(), durationSeconds },
        { requireAuth: true, accessToken: session?.access_token },
      );

      // 4. Stream job status via SSE (BullMQ-backed).
      cancelRequestedRef.current = false;
      setActiveJobId(jobId);
      eventSource = new EventSource(`${BACKEND_URL}/api/v1/dubbing/status/${jobId}`);
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as {
          state: string;
          progress: number;
          message: string;
          finished: boolean;
          error?: string;
          dubbedUrl?: string;
        };

        updateProgress(mapState(data.state), data.progress, data.message);

        if (data.finished) {
          eventSource?.close();
          setActiveJobId(null);

          if (data.state === "completed") {
            setDubbedResult({ projectId: "", dubbedUrl: data.dubbedUrl, targetLanguage });
            toast.success("Dubbing complete 🎉", {
              description: `Your media was dubbed into ${supportedLanguages.find((l) => l.value === targetLanguage)?.label ?? targetLanguage}.`,
            });
          } else if (data.state === "failed") {
            if (cancelRequestedRef.current || (data.error || "").includes("cancelled")) {
              updateProgress("failed", 0, "Cancelled");
              toast.info("Dubbing cancelled", { description: "No credits were charged." });
            } else {
              toast.error("Dubbing failed", { description: data.error || data.message });
            }
          }
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        setActiveJobId(null);
        updateProgress("failed", 0, "Connection lost");
        toast.error("Connection lost", { description: "Please try again" });
      };
    } catch (error) {
      eventSource?.close();
      setActiveJobId(null);
      const message = getApiErrorMessage(error, "Dubbing failed.");
      updateProgress("failed", 0, message);
      toast.error("Error dubbing media", { description: message });
    }
  }, [mediaFile, mediaDuration, targetLanguage, targetAccent, isVideo, mediaName, session, updateProgress, maxDurationSeconds]);

  /** Cancel the in-flight dub: queued jobs stop instantly, active ones abort between stages. */
  const cancelDub = useCallback(async () => {
    if (!activeJobId) return;
    cancelRequestedRef.current = true;
    try {
      const res = await api.post<{ message: string }>(
        `/api/v1/dubbing/stop/${activeJobId}`,
        {},
        { requireAuth: true, accessToken: session?.access_token },
      );
      toast.info(res.message);
    } catch (error) {
      cancelRequestedRef.current = false;
      toast.error("Could not cancel", { description: getApiErrorMessage(error, "Please try again.") });
    }
  }, [activeJobId, session]);

  const isLoading = progress.state === "uploading" || progress.state === "processing";

  return {
    fileInputRef,
    mediaFile,
    mediaDuration,
    isVideo,
    targetLanguage,
    setTargetLanguage,
    targetAccent,
    setTargetAccent,
    mediaName,
    setMediaName,
    dubbedResult,
    progress,
    isLoading,
    allowed,
    accessLoading,
    maxDurationSeconds,
    canCancel: !!activeJobId,
    cancelDub,
    handleFileChange,
    handleFileSelect,
    resetForm,
    handleDubMedia,
  };
}
