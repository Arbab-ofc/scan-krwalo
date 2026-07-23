import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N}_]+$/u, "Use letters, numbers, or underscores only"),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(10).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  confirmPassword: z.string(),
  role: z.enum(["CLIENT", "SCANNER", "ADMIN"]).default("CLIENT"),
  adminSecret: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match"
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1)
});

export const redeemCodeSchema = z.object({
  code: z.string().trim().length(12).regex(/^(SCN|CLI)\d{9}$/i)
});

export const createScannerCodeSchema = z.object({
  expiresAt: z.string().datetime().optional()
});

export const createClientCodeSchema = z.object({
  initialTaskCredits: z.number().int().positive().max(100000),
  recordedPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  expiresAt: z.string().datetime().optional()
});

export const taskCreateSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().max(120).optional(),
  instructions: z.string().trim().max(2000).optional(),
  customRewardAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional()
});

export const taskBulkCreateSchema = z.object({
  urls: z.array(z.string().trim().url()).min(1).max(50)
});

export const submitTaskSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  proofStorageKey: z.string().trim().min(1).optional()
});

export const payoutRequestSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  method: z.enum(["BINANCE_ID", "USDT_BEP20"])
});

export const bep20AddressSchema = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/);
export const binanceIdSchema = z.string().trim().min(4).max(64).regex(/^[a-zA-Z0-9_.-]+$/);
