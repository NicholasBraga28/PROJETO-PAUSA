import { z } from "zod";
import { request } from "@/shared/api/client";
import { User } from "@/shared/api/schemas";

const Location = z.object({
  id: z.string(),
  code: z.enum(["SAO_PAULO", "LONDRINA"]),
  name: z.string(),
  timezone: z.string(),
  active: z.boolean(),
});

const ReportTherapist = z.object({ id: z.string(), name: z.string() });
const Count = z.number().int().nonnegative();
const Demand = z.object({
  byShift: z.array(z.object({ shift: z.enum(["MORNING", "AFTERNOON"]), appointmentCount: Count })),
  mostRequestedShift: z.enum(["MORNING", "AFTERNOON"]).nullable(),
  byWeekday: z.array(
    z.object({
      weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
      appointmentCount: Count,
    }),
  ),
  mostRequestedWeekday: z
    .enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])
    .nullable(),
  byStartTime: z.array(z.object({ time: z.string().regex(/^\d{2}:\d{2}$/), appointmentCount: Count })),
  mostRequestedStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
});

const Cancellation = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  scheduledAppointmentCount: Count,
  cancelledAppointmentCount: Count,
  cancellationRatePercent: z.number().finite().nonnegative(),
});

const FeedbackDistribution = z.array(
  z.strictObject({
    value: z.number().int(),
    count: z.number().int().nonnegative(),
  }),
);

export const FeedbackReport = z.strictObject({
  totalResponses: z.number().int().nonnegative(),
  bookingEase: FeedbackDistribution,
  technologySatisfaction: FeedbackDistribution,
  serviceRating: FeedbackDistribution,
  recommendation: FeedbackDistribution,
  recommendationAverage: z.number().finite().min(0).max(10).nullable(),
  comments: z.array(z.string()),
});

export type FeedbackReport = z.infer<typeof FeedbackReport>;

export const KpiReport = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
    granularity: z.enum(["DAY", "WEEK", "MONTH"]),
    timezone: z.string(),
  }),
  filters: z.object({ locationId: z.string().nullable(), therapistId: z.string().nullable() }),
  demand: Demand,
  cancellations: z.array(Cancellation),
  spokenText: z.string(),
});

export type KpiReport = z.infer<typeof KpiReport>;
export type Granularity = KpiReport["range"]["granularity"];
export type ReportLocation = z.infer<typeof Location>;
export type ReportTherapist = z.infer<typeof ReportTherapist>;

export interface KpiQuery {
  from: string;
  to: string;
  locationId: string;
  therapistId: string;
  granularity: Granularity;
}

export const getReportLocations = () => request("/locations/admin", z.array(Location));

export async function getFeedbackReport() {
  const report = await request("/reports/feedback", FeedbackReport);
  return FeedbackReport.parse(report);
}

export async function getReportTherapists() {
  const users = await request("/users?role=THERAPIST", z.array(User));
  return users.flatMap((user) => (user.therapistId ? [{ id: user.therapistId, name: user.name }] : []));
}

export async function getKpis(filters: KpiQuery) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to, granularity: filters.granularity });
  if (filters.locationId) query.set("locationId", filters.locationId);
  if (filters.therapistId) query.set("therapistId", filters.therapistId);
  const report = await request(`/reports/kpis?${query.toString()}`, KpiReport);
  return KpiReport.parse(report);
}
