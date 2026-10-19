export interface Key {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
    paste?: boolean;
    text?: boolean;
    overflow?: boolean;
}
