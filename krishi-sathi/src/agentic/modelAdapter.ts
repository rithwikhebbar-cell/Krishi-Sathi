import {
  ResearchPlan,
  ResearchReport,
  ResearchTask,
  Evidence,
} from "./contracts/types";

export interface ResearchModelAdapter {
  createPlan(task: ResearchTask): Promise<ResearchPlan>;
  synthesize(task: ResearchTask, evidence: Evidence[]): Promise<ResearchReport>;
}

export * from "./providers/index";
