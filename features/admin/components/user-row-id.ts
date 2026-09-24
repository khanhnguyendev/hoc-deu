/**
 * The id of a queue row's programmatic focus target: UserQueue puts it (with `tabIndex={-1}`) on
 * each row, and UserRowActions moves keyboard focus there after an action, also when the row has
 * moved to another section. A plain module, so the server-rendered queue and the client actions
 * share it.
 */
export const userRowId = (userId: string) => `user-${userId}`
