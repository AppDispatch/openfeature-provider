import type { EvaluationContext } from '@openfeature/core'
import type { FlagDefinition, RuleDefinition } from './types'

export type EvalReason = 'DISABLED' | 'DEFAULT' | 'TARGETING_MATCH' | 'SPLIT' | 'ERROR'

export interface EvalResult {
  value: unknown
  variant: string | undefined
  reason: EvalReason
}

/**
 * Evaluate a flag against the given context.
 * Rules are evaluated in priority order (lower = first).
 * If no rule matches, the flag's default value is returned.
 */
export function evaluateFlag(
  flag: FlagDefinition,
  context: EvaluationContext,
): EvalResult {
  if (!flag.enabled) {
    return { value: flag.defaultValue, variant: undefined, reason: 'DISABLED' }
  }

  // Sort rules by priority (lower = evaluated first)
  const sorted = [...flag.rules].sort((a, b) => a.priority - b.priority)

  for (const rule of sorted) {
    const result = evaluateRule(rule, flag, context)
    if (result) return result
  }

  // No rule matched — return default
  const defaultVariation = flag.variations.find(
    (v) => JSON.stringify(v.value) === JSON.stringify(flag.defaultValue),
  )
  return {
    value: flag.defaultValue,
    variant: defaultVariation?.name ?? undefined,
    reason: 'DEFAULT',
  }
}

function evaluateRule(
  rule: RuleDefinition,
  flag: FlagDefinition,
  context: EvaluationContext,
): EvalResult | null {
  switch (rule.ruleType) {
    case 'user_list':
      return evaluateUserList(rule, flag, context)
    case 'percentage_rollout':
      return evaluatePercentageRollout(rule, flag, context)
    default:
      return null
  }
}

function evaluateUserList(
  rule: RuleDefinition,
  flag: FlagDefinition,
  context: EvaluationContext,
): EvalResult | null {
  const userIds = (rule.ruleConfig.userIds as string) ?? ''
  const ids = userIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const targetingKey = context.targetingKey
  if (!targetingKey || !ids.includes(targetingKey)) {
    return null
  }

  const variation = flag.variations.find(
    (v) => JSON.stringify(v.value) === JSON.stringify(rule.variantValue),
  )

  return {
    value: rule.variantValue,
    variant: variation?.name ?? undefined,
    reason: 'TARGETING_MATCH',
  }
}

function evaluatePercentageRollout(
  rule: RuleDefinition,
  flag: FlagDefinition,
  context: EvaluationContext,
): EvalResult | null {
  const rollout = rule.ruleConfig.rollout as
    | Array<{ variationId: number; weight: number }>
    | undefined

  if (!rollout || rollout.length === 0) return null

  // Deterministic bucket based on targeting key
  const targetingKey = context.targetingKey ?? ''
  const bucket = hashToBucket(flag.key + targetingKey)

  let cumulative = 0
  for (const entry of rollout) {
    cumulative += entry.weight
    if (bucket < cumulative) {
      const variation = flag.variations.find((v) => v.id === entry.variationId)
      return {
        value: variation?.value ?? flag.defaultValue,
        variant: variation?.name ?? undefined,
        reason: 'SPLIT',
      }
    }
  }

  // Fallback (shouldn't happen if weights sum to 100)
  return null
}

/**
 * Simple deterministic hash → 0–99 bucket.
 * Uses FNV-1a for speed and decent distribution.
 */
function hashToBucket(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash % 100
}
