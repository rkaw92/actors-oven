import type { Identity } from './identity';
import type { MetadataType } from './metadata';

export abstract class DomainEvent<Payload extends {}> {
    public abstract readonly type: string;
    public abstract payload: Payload;
}

export class DomainEventEnvelope<Event extends DomainEvent<{}>> {
    constructor(
        public readonly event: Event,
        public readonly origin: Identity,
        public readonly version: number,
        // TODO: Stricter typing for metadata in a system?
        public readonly metadata: MetadataType,
    ) { }
}
