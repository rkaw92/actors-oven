import type { Command } from '../types/command';
import type { DomainEvent, DomainEventEnvelope } from '../types/event';
import type { Identity } from '../types/identity';
import type { EventSource, EventSink } from '../types/infra';
import { SystemTimers, type Timer, type TimerProvider } from '../types/time';
import type { Entity } from './entity';
import { LiveEntitySupervisor } from './supervisor';

interface RunState<EntityType extends Entity<any>> {
    runCommand(command: Command<EntityType>): Promise<void>;
}

class Loading<E extends Entity<any>> implements RunState<E> {
    constructor(private loaded: Promise<RunState<E>>) {}

    runCommand(command: Command<E>): Promise<void> {
        return this.loaded.then((runner) => runner.runCommand(command));
    }
}

class Running<E extends Entity<any>> implements RunState<E> {
    constructor(private supervisor: LiveEntitySupervisor<E>) {}
    
    runCommand(command: Command<E>): Promise<void> {
        return this.supervisor.runCommand(command);
    }
}

export interface IdleCallback {
    (): void;
}

export class EntityLifecycleManager<EntityType extends Entity<any>> {
    protected runner: RunState<EntityType>;
    protected idleTimer: Timer | undefined;
    protected onIdle: IdleCallback = () => {};

    constructor(
        protected factory: () => EntityType,
        protected source: EventSource,
        protected sink: EventSink,
        protected id: Identity,
        protected idleTimeoutMs: number,
        protected timerProvider: TimerProvider,
    ) {
        this.runner = new Loading(this.loadEntity());
    }

    protected async loadEntity() {
        const supervisor = new LiveEntitySupervisor(
            this.sink,
            this.factory(),
            this.id,
        );
        await supervisor.rehydrateFromEvents(this.source.load(this.id));
        return new Running(supervisor);
    }

    protected startIdleTimer() {
        this.idleTimer = this.timerProvider.setTimer(
            () => this.onIdle(),
            this.idleTimeoutMs
        );
    }

    setIdleCallback(onIdle: IdleCallback) {
        this.onIdle = onIdle;
    }

    async runCommand(command: Command<EntityType>) {
        this.idleTimer?.clear();
        try {
            return await this.runner.runCommand(command);
        } finally {
            this.startIdleTimer();
        }
    }
}
