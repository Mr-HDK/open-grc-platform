const duplicateKeyPattern = /duplicate key value violates unique constraint/i;
const foreignKeyPattern = /violates foreign key constraint/i;
const uuidPattern = /invalid input syntax for type uuid/i;
const checkConstraintPattern = /violates check constraint/i;
const forbiddenPattern = /(forbidden|permission denied|not allowed)/i;

export function toUserErrorMessage(rawMessage: string | null | undefined, fallback: string) {
  if (!rawMessage) {
    return fallback;
  }

  if (duplicateKeyPattern.test(rawMessage)) {
    return "A record with the same unique value already exists.";
  }

  if (foreignKeyPattern.test(rawMessage)) {
    return "One linked record no longer exists or cannot be used.";
  }

  if (uuidPattern.test(rawMessage)) {
    return "One submitted identifier is invalid.";
  }

  if (checkConstraintPattern.test(rawMessage)) {
    return "Submitted data is incomplete or invalid.";
  }

  if (forbiddenPattern.test(rawMessage)) {
    return "You do not have permission to perform this action.";
  }

  return rawMessage;
}
