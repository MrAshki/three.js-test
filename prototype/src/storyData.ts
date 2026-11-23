export type StageId = 'detection' | 'evidence' | 'recommendation' | 'decision' | 'outcome'
export type DecisionId = 'pending' | 'approve' | 'reject' | 'analysis'
export type OutcomeId = 'improvement' | 'deterioration' | 'no-change' | 'too-early'

export type StoryStage = {
  id: StageId
  step: string
  title: string
  shortTitle: string
  eyebrow: string
  summary: string
  insight: string
  action: string
  sales: number[]
  inventory: number[]
  sceneIntensity: number
}

export const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
export const stageOrder: StageId[] = ['detection', 'evidence', 'recommendation', 'decision', 'outcome']

export const decisionOptions: Array<{ id: Exclude<DecisionId, 'pending'>; label: string; shortLabel: string }> = [
  { id: 'approve', label: 'Approve limited review', shortLabel: 'Approve' },
  { id: 'reject', label: 'Reject recommendation', shortLabel: 'Reject' },
  { id: 'analysis', label: 'Request more analysis', shortLabel: 'More analysis' },
]

export const outcomeForDecision: Record<DecisionId, OutcomeId> = {
  pending: 'too-early',
  approve: 'improvement',
  reject: 'no-change',
  analysis: 'too-early',
}

const baseStages: Record<StageId, StoryStage> = {
  detection: {
    id: 'detection', step: '01', title: 'A category breaks the pattern', shortTitle: 'Detection', eyebrow: 'Signal detected',
    summary: 'Accessories sales fell 18% while other retail categories stayed within their normal ranges.',
    insight: 'The decline starts in April and continues for three reporting periods.',
    action: 'Open the evidence stage to compare the sales and inventory observations.',
    sales: [118, 121, 119, 108, 101, 98], inventory: [72, 76, 81, 88, 94, 99], sceneIntensity: 1,
  },
  evidence: {
    id: 'evidence', step: '02', title: 'Observed signals move in opposite directions', shortTitle: 'Evidence', eyebrow: 'Evidence assembled',
    summary: 'Accessories sales declined while inventory increased by 27 units during the same period.',
    insight: 'Both trends are confirmed observations. Their relationship does not prove why sales declined.',
    action: 'Review the AI proposal as a testable recommendation, not as a causal conclusion.',
    sales: [118, 121, 119, 108, 101, 98], inventory: [72, 76, 81, 88, 94, 99], sceneIntensity: 1.15,
  },
  recommendation: {
    id: 'recommendation', step: '03', title: 'Review replenishment priorities', shortTitle: 'AI Recommendation', eyebrow: 'Recommendation ready',
    summary: 'The AI proposes a limited replenishment review for affected Accessories products.',
    insight: 'The proposal uses the observed sales and inventory signals. It does not claim a confirmed cause.',
    action: 'Send the proposed review to the manager for a simulated decision.',
    sales: [118, 121, 119, 108, 101, 98], inventory: [72, 76, 81, 88, 94, 99], sceneIntensity: 0.9,
  },
  decision: {
    id: 'decision', step: '04', title: 'The manager selects a simulated response', shortTitle: 'Manager Decision', eyebrow: 'Decision required',
    summary: 'Choose whether to approve, reject, or request more analysis for the proposed replenishment review.',
    insight: 'This choice changes the simulated path only. It does not execute a real business action.',
    action: 'Select one response, then advance to the simulated evaluation.',
    sales: [118, 121, 119, 108, 101, 98], inventory: [72, 76, 81, 88, 94, 99], sceneIntensity: 0.75,
  },
  outcome: {
    id: 'outcome', step: '05', title: 'The evaluation is not ready', shortTitle: 'Outcome', eyebrow: 'Simulated evaluation',
    summary: 'No manager response is selected, so the outcome is too early to evaluate.',
    insight: 'The model keeps improvement, deterioration, no change, and too early as separate states.',
    action: 'Return to the decision stage and select a simulated response.',
    sales: [118, 121, 119, 108, 101, 98], inventory: [72, 76, 81, 88, 94, 99], sceneIntensity: 0.4,
  },
}

const decisionStages: Record<Exclude<DecisionId, 'pending'>, Partial<StoryStage>> = {
  approve: {
    title: 'Manager approves a limited review', eyebrow: 'Simulated approval',
    summary: 'The manager approves a limited replenishment review for affected Accessories products.',
    insight: 'The response is reversible and remains clearly marked as a simulation.',
    action: 'Advance to evaluate the simulated observation after the approved review.',
  },
  reject: {
    title: 'Manager rejects the recommendation', eyebrow: 'Simulated rejection',
    summary: 'The manager rejects the proposed replenishment review and keeps the current plan.',
    insight: 'The response avoids an unsupported change but leaves the observed anomaly unresolved.',
    action: 'Advance to evaluate the simulated observation after no change in plan.',
  },
  analysis: {
    title: 'Manager requests more analysis', eyebrow: 'Analysis requested',
    summary: 'The manager asks for product-level and store-level evidence before making a change.',
    insight: 'The response delays action because the available evidence does not establish causality.',
    action: 'Advance to see why the evaluation remains too early.',
  },
}

const outcomeStages: Record<DecisionId, Partial<StoryStage>> = {
  pending: {},
  approve: {
    title: 'The simulated signal improves',
    summary: 'Sales improve by 9 index points while inventory moves toward its earlier range after the simulated review.',
    insight: 'The timing is compatible with improvement, but it does not prove that the review caused the change.',
    action: 'Restart the journey or compare another simulated manager response.',
    sales: [118, 121, 119, 108, 103, 107], inventory: [72, 76, 81, 88, 86, 82],
  },
  reject: {
    title: 'The simulated signal shows no change',
    summary: 'Sales and inventory remain near the observed levels after the manager keeps the current plan.',
    insight: 'This simulation shows no material change. It does not predict a real business result.',
    action: 'Return to the decision stage to compare another simulated response.',
    sales: [118, 121, 119, 108, 100, 99], inventory: [72, 76, 81, 88, 96, 98],
  },
  analysis: {
    title: 'It is too early to evaluate',
    summary: 'The manager requested more analysis, so no simulated operational action has started.',
    insight: 'More evidence is required before improvement, deterioration, or no change can be evaluated.',
    action: 'Return to the decision stage or restart the journey.',
  },
}

export function getStoryStage(stageId: StageId, decision: DecisionId): StoryStage {
  const base = baseStages[stageId]
  if (stageId === 'decision' && decision !== 'pending') return { ...base, ...decisionStages[decision] }
  if (stageId === 'outcome') return { ...base, ...outcomeStages[decision] }
  return base
}

export const storyStages = stageOrder.map((stageId) => baseStages[stageId])
