import type { Command } from '../types/command';
import type { Identity } from '../types/identity';
import type { EventSink, EventSource } from '../types/infra';
import { SystemTimers, type TimerProvider } from '../types/time';
import type { Entity } from './entity';
import { EntityLifecycleManager } from './lifecycle';

export class Repository<EntityType extends Entity<any>> {
    // Defaults, overridable at runtime before construction:
    public static DEFAULT_IDLE_TIMEOUT_MS = 5_000;
    public static DEFAULT_TIMER_PROVIDER = new SystemTimers();

    protected idleTimeoutMs = Repository.DEFAULT_IDLE_TIMEOUT_MS;
    protected timerProvider: TimerProvider = Repository.DEFAULT_TIMER_PROVIDER;
    protected liveEntities = new Map<string, EntityLifecycleManager<EntityType>>();

    constructor(
        protected identity: Pick<Identity, "type">,
        protected factory: () => EntityType,
        protected source: EventSource,
        protected sink: EventSink,
    ) {}

    private start(id: Identity) {
        const liveEntity = new EntityLifecycleManager(
            this.factory,
            this.source,
            this.sink,
            id,
            this.idleTimeoutMs,
            this.timerProvider,
        );
        this.liveEntities.set(id.id, liveEntity);
        liveEntity.setIdleCallback(() => {
            this.liveEntities.delete(id.id);
        });
        return liveEntity;
    }

    setIdleTimeout(ms: number) {
        this.idleTimeoutMs = ms;
    }

    setTimerProvider(provider: TimerProvider) {
        this.timerProvider = provider;
    }

    runCommand(id: Identity, command: Command<EntityType>) {
        if (id.type !== this.identity.type) {
            // TODO: Better error types
            throw new Error('Entity type mismatch');
        }
        let liveEntity = this.liveEntities.get(id.id);
        if (!liveEntity) {
            liveEntity = this.start(id);
        }
        return liveEntity.runCommand(command);
    }
}
