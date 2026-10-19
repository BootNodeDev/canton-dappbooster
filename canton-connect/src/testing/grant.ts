type Grant = { receiver: string }

export const toGrant = (createArgument: unknown): Grant | undefined =>
  typeof createArgument === 'object' &&
  createArgument !== null &&
  'receiver' in createArgument &&
  typeof createArgument.receiver === 'string'
    ? { receiver: createArgument.receiver }
    : undefined
