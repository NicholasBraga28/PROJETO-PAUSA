import { z } from "zod";
import { request } from "@/shared/api/client";

export const BusinessRuleType = z.enum(["MINUTES", "DAYS", "COUNT", "TIME_OF_DAY", "WEEKDAYS"]);

export const BusinessRule = z.object({
  key: z.string(),
  value: z.string(),
  type: BusinessRuleType,
  description: z.string(),
});

export type BusinessRule = z.infer<typeof BusinessRule>;
export type BusinessRuleType = z.infer<typeof BusinessRuleType>;

export const getBusinessRules = () => request("/business-rules", z.array(BusinessRule));

export const updateBusinessRule = (key: string, value: string) =>
  request(`/business-rules/${encodeURIComponent(key)}`, BusinessRule, { method: "PATCH", body: { value } });
