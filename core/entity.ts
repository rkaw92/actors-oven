import { type DomainEvent } from '../types/event';
import { kEvents } from './symbols';

export abstract class Entity<
    StateType,
    EventType extends DomainEvent<any> = DomainEvent<{}>,
> {
    public [kEvents]: Array<EventType> = [];
    protected state: StateType;

    constructor(initialState: StateType) {
        this.state = initialState;
    }

    protected emit(event: EventType) {
        this.handleEvent(event);
        this[kEvents].push(event);
    }

    public getEvents() {
        return this[kEvents].slice();
    }

    public abstract handleEvent(event: EventType): void;
}

export type StateOf<T> = T extends Entity<infer StateType, any> ? StateType : never;
export type EventOf<T> = T extends Entity<any, infer EventType> ? EventType : never;
