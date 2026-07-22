import type { FastifyReply } from "fastify";
import { DomainError } from "@scan-krwalo/shared";

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
  reply.request.log.error({ error }, "Unhandled request error");
  return reply.status(500).send({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", details: null },
    meta: { requestId: reply.request.id }
  });
}
