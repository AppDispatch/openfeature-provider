import type {
  CommonProvider,
  ClientProviderStatus,
  EvaluationContext,
  JsonValue,
  ProviderMetadata,
  ResolutionDetails,
} from "@openfeature/core";
import { ErrorCode } from "@openfeature/core";
import type {
  DispatchProviderOptions,
  FlagDefinition,
  FlagPayload,
} from "./types";
import { evaluateFlag } from "./evaluator";

export class DispatchProvider implements CommonProvider<ClientProviderStatus> {
  readonly metadata: ProviderMetadata = { name: "appdispatch" };
  readonly runsOn = "client" as const;

  private flags: Map<string, FlagDefinition> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly options: Required<
    Pick<DispatchProviderOptions, "baseUrl" | "projectSlug">
  > &
    DispatchProviderOptions;

  constructor(options: DispatchProviderOptions) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    await this.fetchFlags();

    const interval = this.options.pollIntervalMs ?? 30_000;
    if (interval > 0) {
      this.pollTimer = setInterval(() => this.fetchFlags(), interval);
    }
  }

  async onClose(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): ResolutionDetails<boolean> {
    return this.resolve(flagKey, defaultValue, context);
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): ResolutionDetails<string> {
    return this.resolve(flagKey, defaultValue, context);
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): ResolutionDetails<number> {
    return this.resolve(flagKey, defaultValue, context);
  }

  resolveObjectEvaluation(
    flagKey: string,
    defaultValue: JsonValue,
    context: EvaluationContext,
  ): ResolutionDetails<JsonValue> {
    return this.resolve(flagKey, defaultValue, context);
  }

  private resolve<T>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): ResolutionDetails<T> {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      return {
        value: defaultValue,
        reason: "ERROR",
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `Flag "${flagKey}" not found`,
      };
    }

    const result = evaluateFlag(flag, context);
    return {
      value: (result.value as T) ?? defaultValue,
      variant: result.variant,
      reason: result.reason,
    };
  }

  private async fetchFlags(): Promise<void> {
    try {
      const url = new URL(
        `/v1/ota/flag-definitions/${encodeURIComponent(this.options.projectSlug)}`,
        this.options.baseUrl,
      );
      if (this.options.channel) {
        url.searchParams.set("channel", this.options.channel);
      }

      const headers: Record<string, string> = {};
      if (this.options.apiKey) {
        headers["Authorization"] = `Bearer ${this.options.apiKey}`;
      }

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        console.warn(`[AppDispatch] Failed to fetch flags: ${res.status}`);
        return;
      }

      const payload: FlagPayload = await res.json();
      const next = new Map<string, FlagDefinition>();
      for (const flag of payload.flags) {
        next.set(flag.key, flag);
      }
      this.flags = next;
    } catch (err) {
      console.warn("[AppDispatch] Failed to fetch flags:", err);
    }
  }

  /** Get all currently loaded flag definitions (for debugging) */
  getFlags(): ReadonlyMap<string, FlagDefinition> {
    return this.flags;
  }
}
