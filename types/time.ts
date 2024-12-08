export interface Timer {
    clear(): void;
}

export interface TimerProvider {
    setTimer(callback: () => any, ms: number): Timer;
}

class SystemTimer implements Timer {
    constructor(private handle: ReturnType<typeof setTimeout>) {}

    clear() {
        clearTimeout(this.handle);
    }
}

export class SystemTimers implements TimerProvider {
    setTimer(callback: () => any, ms: number) {
        return new SystemTimer(setTimeout(callback, ms));
    }
}

export class FakeTimers implements TimerProvider {
    private allCallbacks = new Set<() => void>;

    setTimer(callback: () => any, ms: number) {
        // Make sure we don't accidentally deduplicate the timer:
        const uniqueCallback = () => callback();
        this.allCallbacks.add(uniqueCallback);
        return {
            clear: () => void this.allCallbacks.delete(uniqueCallback)
        };
    }

    flush() {
        console.log('--- flushing timers');
        // NOTE: In this fake implementation, timers run in the order of addition, not by delay ms.
        for (const callback of this.allCallbacks) {
            callback();
            this.allCallbacks.delete(callback);
        }
    }
}
