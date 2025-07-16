import { db } from "~/server/db";
import { users, userRequests } from "~/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export const REQUESTS_PER_DAY = 50;

export async function checkRateLimit(userId: string): Promise<boolean> {
  // Fetch isAdmin from DB
  const userList = await db.select().from(users).where(eq(users.id, userId));
  const user = userList[0];
  if (!user) return false;
  if (user.isAdmin) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const requestsToday = await db.query.userRequests.findMany({
    where: and(
      eq(userRequests.userId, userId),
      gte(userRequests.requestedAt, today),
      lte(userRequests.requestedAt, tomorrow),
    ),
  });
  return requestsToday.length < REQUESTS_PER_DAY;
}

export async function recordRequest(userId: string) {
  await db.insert(userRequests).values({ userId });
}
