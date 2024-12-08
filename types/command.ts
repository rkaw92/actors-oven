export abstract class Command<Receiver> {
    abstract execute(receiver: Receiver): void | Promise<void>;
    
    public expectedVersion?: number;
    public metadata? = {};
}
