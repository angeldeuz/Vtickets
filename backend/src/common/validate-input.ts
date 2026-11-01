import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

export function validateInput<T extends z.ZodType>(schema: T, value: unknown, message: string): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? "");
    if (name && !fields[name]) fields[name] = issue.message;
  }
  throw new BadRequestException({ code: "VALIDATION_ERROR", message, details: { fields } });
}
