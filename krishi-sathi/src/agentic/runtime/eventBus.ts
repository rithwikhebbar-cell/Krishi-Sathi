import { randomUUID } from "crypto";
import { RuntimeEvent, RuntimeEventType } from "../contracts/types";

export type RuntimeEventListener = (event: RuntimeEvent) => void | Promise<void>;

export class RuntimeEventBus {
  private readonly listeners = new Set<RuntimeEventListener>();
  private readonly events: RuntimeEvent[] = [];

  emit(taskId: string, type: RuntimeEventType, payload: Record<string, unknown> = {}): RuntimeEvent {
    const event: RuntimeEvent = {
      id: `evt_${randomUUID()}`,
      taskId,
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    this.events.push(event);

    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((err) => {
            console.error("RuntimeEventBus async listener error:", err);
          });
        }
      } catch (err) {
        console.error("RuntimeEventBus listener error:", err);
      }
    }

    return event;
  }

  subscribe(listener: RuntimeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEvents(taskId?: string): RuntimeEvent[] {
    if (!taskId) return [...this.events];
    return this.events.filter((e) => e.taskId === taskId);
  }

  clear(taskId?: string): void {
    if (!taskId) {
      this.events.length = 0;
    } else {
      const remaining = this.events.filter((e) => e.taskId !== taskId);
      this.events.length = 0;
      this.events.push(...remaining);
    }
  }
}
