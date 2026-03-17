import { z } from "zod"

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const uploadFileSchema = z.object({
  gymId: z.string().min(1),
  fileType: z.enum(["FICHA", "APTO_MEDICO"]),
})

export type UploadFileInput = z.infer<typeof uploadFileSchema>
