import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import categoriesRouter from "./categories";
import dashboardRouter from "./dashboard";
import exportRouter from "./export";
import accountRouter from "./account";
import importRouter from "./import";
import goalsRouter from "./goals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(categoriesRouter);
router.use(dashboardRouter);
router.use(exportRouter);
router.use(accountRouter);
router.use(importRouter);
router.use(goalsRouter);

export default router;
