import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { isRetryableTransactionError } from "./transaction-errors";

const MAX_TRANSACTION_ATTEMPTS = 3;

export async function inSerializableTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= MAX_TRANSACTION_ATTEMPTS || !isRetryableTransactionError(error)) throw error;
    }
  }
}
