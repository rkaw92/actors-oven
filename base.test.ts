import { expect, test } from 'bun:test';
import { type EventSink, type EventSource } from './types/infra';
import { LiveEntitySupervisor } from './core/supervisor';
import { Entity } from './core/entity';
import { DomainEventEnvelope } from './types/event';
import { DomainEvent } from './types/event';
import { Identity } from './types/identity';
import { Command } from './types/command';
import { EntityLifecycleManager } from './core/lifecycle';
import { Repository } from './core/repository';
import { FakeTimers } from './types/time';

class OrderPlaced extends DomainEvent<{}> {
    public readonly type = 'OrderPlaced';
    public readonly payload = {};
}
class OrderCancelled extends DomainEvent<{}> {
    public readonly type = 'OrderCancelled';
    public readonly payload = {};
}
type OrderEvent = OrderPlaced | OrderCancelled;

class Place extends Command<Order> {
    execute(o: Order): void | Promise<void> {
        o.place();
    }
}

class Cancel extends Command<Order> {
    execute(o: Order): void | Promise<void> {
        o.cancel();
    }
}

class Order extends Entity<{
    placed: boolean,
    cancelled: boolean
}, OrderEvent> {
    constructor() {
        super({
            placed: false,
            cancelled: false,
        });
    }

    public handleEvent(event: OrderEvent): void {
        switch (event.type) {
            case 'OrderPlaced':
                this.state.placed = true;
                break;
            case 'OrderCancelled':
                this.state.cancelled = true;
                break;
            default:
                throw new Error('Event type unknown');
        }
    }

    public place() {
        if (this.state.cancelled) {
            throw new Error('Order is already cancelled');
        }
        if (this.state.placed) {
            return;
        }
        this.emit(new OrderPlaced());
    }

    public cancel() {
        if (this.state.cancelled) {
            return;
        }
        this.emit(new OrderCancelled());
    }

    public isPlaced() {
        return this.state.placed;
    }
}

function getFakeDB() {
    const eventsTape: DomainEventEnvelope<any>[] = [];
    const sink: EventSink = {
        persist(envelopes) {
            eventsTape.push(...envelopes);
            for (const envelope of envelopes) {
                console.log('Store: %s', JSON.stringify(envelope));
            }
            return Promise.resolve();
        }
    };
    const source: EventSource = {
        async *load(id) {
            for (const envelope of eventsTape.filter((envelope) => envelope.origin.id === id.id)) {
                console.log('Load: %s', JSON.stringify(envelope));
                yield envelope;
            }
        }
    };
    return { source, sink };
}

test('Entity', function () {
    const order = new Order();
    expect(order.getEvents().length).toEqual(0);
    order.place();
    expect(order.getEvents().length).toEqual(1);
    expect(order.isPlaced()).toEqual(true);
});

test('EntitySupervisor', async function () {
    let eventsTape: DomainEventEnvelope<any>[] = [];
    const { sink } = getFakeDB();
    const supervisor = new LiveEntitySupervisor(
        sink,
        new Order(),
        new Identity('Order', 'ORDER-1'),
    );
    await supervisor.runCommand(
        new Place()
    );
    console.log(eventsTape);
});

test('EntityLifecycleManager', async function () {
    let eventsTape: DomainEventEnvelope<any>[] = [];
    const { source, sink } = getFakeDB();
    const fakeTimers = new FakeTimers();
    // Force block-scoped variables to simulate unload:
    {
        
        let manager = new EntityLifecycleManager(
            () => new Order(),
            source,
            sink,
            { type: 'Order', id: 'ORDER-1' },
            1000,
            fakeTimers,
        );
        await manager.runCommand(new Place());
        const unload = new Promise<void>((resolve) => {
            manager.setIdleCallback(() => {
                console.log('entity is idle, unloading...');
                resolve();
            });
        });
        fakeTimers.flush();
        await unload;
    }
    {
        const manager2 = new EntityLifecycleManager(
            () => new Order(),
            source,
            sink,
            { type: 'Order', id: 'ORDER-1' },
            1000,
            fakeTimers
        );
        await manager2.runCommand(new Cancel());
    }
});

test.only('Repository', async function() {
    const { source, sink } = getFakeDB();
    const repo = new Repository(
        { type: 'Order' },
        () => new Order(),
        source,
        sink,
    );
    const fakeTimers = new FakeTimers();
    repo.setTimerProvider(fakeTimers);
    await repo.runCommand({ type: 'Order', id: 'ORDER-1' }, new Place());
    fakeTimers.flush();
    await repo.runCommand({ type: 'Order', id: 'ORDER-1' }, {
        execute: (order) => console.log(order)
    });
    await repo.runCommand({ type: 'Order', id: 'ORDER-2' }, new Cancel());
    await repo.runCommand({ type: 'Order', id: 'ORDER-2' }, {
        execute: (order) => console.log(order)
    });
});
