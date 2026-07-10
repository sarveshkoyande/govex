// Draft types for the manual tracker create/edit form. Submitted as one
// controlled React-state tree to a server action. Shape mirrors the sample
// theme page: strategy goals + OKRs, micro-battles → tactics → insights, and
// strategy-vs-outcome synthesis cards.

export interface StakeholderDraft {
  name: string;
  email: string;
  roleOnTracker: string;
  ownsWhat: string;
  isPrimary: boolean;
}

export interface FinancialMetricDraft {
  label: string;
  period: string;
  unit: string;
  planned: string;
  actual: string;
  forecast: string;
  confidence: number;
}

export interface RiskDraft {
  title: string;
  severity: string;
  status: string;
  mitigation: string;
  owner: string;
  confidence: number;
}

export interface ActionDraft {
  title: string;
  owner: string;
  assigneeGroup: string;
  priority: string;
  status: string;
  dueDate: string;
}

export interface DecisionDraft {
  decision: string;
  rationale: string;
  decidedBy: string;
}

export interface GoalDraft {
  text: string;
}

export interface OkrDraft {
  title: string;
  metrics: string;
  tags: string; // comma-separated
}

export interface InsightDraft {
  signal: string; // RISK | WATCH | ON_TRACK | OPPORTUNITY | NONE
  text: string;
}

export interface TacticDraft {
  name: string;
  expectedOutcome: string;
  status: string;
  executionInsights: InsightDraft[];
  outcomeInsights: InsightDraft[];
}

export interface MicroBattleDraft {
  code: string;
  name: string;
  ragStatus: string;
  tactics: TacticDraft[];
}

export interface StrategyInsightDraft {
  title: string;
  description: string;
}

export interface TrackerDraft {
  id?: string;
  domainId: string;
  name: string;
  description: string;
  strategyObjective: string;
  okrObjective: string;
  lifecycleStatus: string;
  ragStatus: string;
  signalStatus: string;
  ownerName: string;
  targetPeriod: string;
  currency: string;
  budget: string;
  spend: string;
  forecast: string;
  overallConfidence: number;
  stakeholders: StakeholderDraft[];
  financialMetrics: FinancialMetricDraft[];
  risks: RiskDraft[];
  nextActions: ActionDraft[];
  decisionLog: DecisionDraft[];
  strategyGoals: GoalDraft[];
  okrs: OkrDraft[];
  microBattles: MicroBattleDraft[];
  strategyInsights: StrategyInsightDraft[];
}

export const blankStakeholder = (): StakeholderDraft => ({ name: "", email: "", roleOnTracker: "", ownsWhat: "", isPrimary: false });
export const blankFinancial = (): FinancialMetricDraft => ({ label: "", period: "", unit: "USD_M", planned: "", actual: "", forecast: "", confidence: 50 });
export const blankRisk = (): RiskDraft => ({ title: "", severity: "Medium", status: "Open", mitigation: "", owner: "", confidence: 50 });
export const blankAction = (): ActionDraft => ({ title: "", owner: "", assigneeGroup: "you", priority: "medium", status: "open", dueDate: "" });
export const blankDecision = (): DecisionDraft => ({ decision: "", rationale: "", decidedBy: "" });
export const blankGoal = (): GoalDraft => ({ text: "" });
export const blankOkr = (): OkrDraft => ({ title: "", metrics: "", tags: "" });
export const blankInsight = (): InsightDraft => ({ signal: "ON_TRACK", text: "" });
export const blankTactic = (): TacticDraft => ({ name: "", expectedOutcome: "", status: "Open", executionInsights: [], outcomeInsights: [] });
export const blankMicroBattle = (): MicroBattleDraft => ({ code: "", name: "", ragStatus: "GREEN", tactics: [] });
export const blankStrategyInsight = (): StrategyInsightDraft => ({ title: "", description: "" });

export const blankTracker = (domainId = ""): TrackerDraft => ({
  domainId,
  name: "",
  description: "",
  strategyObjective: "",
  okrObjective: "",
  lifecycleStatus: "DRAFT",
  ragStatus: "GREEN",
  signalStatus: "ON_TRACK",
  ownerName: "",
  targetPeriod: "",
  currency: "USD",
  budget: "",
  spend: "",
  forecast: "",
  overallConfidence: 50,
  stakeholders: [],
  financialMetrics: [],
  risks: [],
  nextActions: [],
  decisionLog: [],
  strategyGoals: [],
  okrs: [],
  microBattles: [],
  strategyInsights: [],
});
