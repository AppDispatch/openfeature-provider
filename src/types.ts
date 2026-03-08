export interface DispatchProviderOptions {
  /** Base URL of your Dispatch OTA server (e.g. "https://ota.example.com") */
  baseUrl: string
  /** Project slug for fetching flag definitions */
  projectSlug: string
  /** Optional channel name (e.g. "production", "staging") */
  channel?: string
  /** Polling interval in ms for refreshing flag definitions (default: 30000) */
  pollIntervalMs?: number
  /** Optional API key for authenticated requests */
  apiKey?: string
}

export interface RuleDefinition {
  priority: number
  ruleType: string
  variantValue: unknown
  ruleConfig: Record<string, unknown>
}

export interface VariationDefinition {
  id: number
  value: unknown
  name: string | null
}

export interface FlagDefinition {
  key: string
  flagType: string
  defaultValue: unknown
  enabled: boolean
  rules: RuleDefinition[]
  variations: VariationDefinition[]
}

export interface FlagPayload {
  flags: FlagDefinition[]
}
