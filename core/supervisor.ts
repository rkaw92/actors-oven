import PQueue from 'p-queue';
import { DomainEventEnvelope } from '../types/event';
import { type EventSink } from '../types/infra';
import { Entity, type EventOf } from './entity';
import { kEvents } from './symbols';
import type { Identity } from '../types/identity';
import type { Command } from '../types/command';

export class LiveEntitySupervisor<EntityType extends Entity<any>> {
    private commandQueue: PQueue = new PQueue({ concurrency: 1 });
    constructor(
        protected sink: EventSink,
        protected instance: EntityType,
        protected id: Identity,
        protected currentVersion: number = 0
    ) {}

    public async rehydrateFromEvents(persistedStream: AsyncIterable<DomainEventEnvelope<EventOf<EntityType>>>): Promise<void> {
        for await (const envelope of persistedStream) {
            this.instance.handleEvent(envelope.event);
            this.currentVersion = envelope.version;
        }
    }

    // TODO: Snapshot support

    public async runCommand(command: Command<EntityType>) {
        await this.commandQueue.add(async () => {
            if (typeof command.expectedVersion === 'number' && command.expectedVersion !== this.currentVersion) {
                // TODO: Better error types
                throw new Error(`Version conflict - expected ${command.expectedVersion}, but we have ${this.currentVersion}, has somebody else modified the entity?`);
            }
            await command.execute(this.instance);
            const envelopes = this.instance[kEvents].map(
                (event, index) => new DomainEventEnvelope(
                    event,
                    this.id,
                    this.currentVersion + index + 1,
                    command.metadata ?? {}
                )
            );
            await this.sink.persist(envelopes);
            this.instance[kEvents].length = 0;
        });
    }
}
