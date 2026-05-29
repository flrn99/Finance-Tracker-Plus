import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

router.delete("/account", async (req, res) => {
  const userId = (req as any).userId;

  try {
    // Delete all user data
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await db.delete(categoriesTable).where(eq(categoriesTable.userId, userId));

    // Delete user from Supabase Auth
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
