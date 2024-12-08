import type { DomainEventEnvelope } from './event';
import type { Identity } from './identity';

export interface EventSink {
    persist(events: DomainEventEnvelope<any>[]): Promise<void>;
}

export interface EventSource {
    load(identity: Identity): AsyncIterable<DomainEventEnvelope<any>>;
}
