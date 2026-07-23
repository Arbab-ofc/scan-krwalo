import type { FastifyReply } from "fastify";
import { DomainError } from "@scan-krwalo/shared";
import { ZodError } from "zod";

export function ok<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.status(statusCode).send({
    success: true,
    data,
    meta: { requestId: reply.request.id }
  });
}

export function fail(reply: FastifyReply, error: unknown) {
  if (error instanceof DomainError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
      meta: { requestId: reply.request.id }
    });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields and try again.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      meta: { requestId: reply.request.id }
    });
  }
  reply.request.log.error({ error }, "Unhandled request error");
  return reply.status(500).send({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", details: null },
    meta: { requestId: reply.request.id }
  });
}
