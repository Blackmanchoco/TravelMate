export function safeEvaluationStop(error) {
  const message = error?.message ?? '';
  const failure = /^EVALUATION_STOP_([a-z0-9_]+)_([1-3])$/.exec(message);
  if (failure) return { caseId: failure[1], iteration: Number(failure[2]),
    reason: ['HTTP status mismatch', 'Fixed reply mismatch', 'Tool usage mismatch', 'Missing model call', 'Regression assertion failed'].includes(error.reason)
      ? error.reason : 'Response or tool usage did not satisfy the fixed acceptance assertion' };
  return /^(?:[A-Z][A-Z0-9_]+|CHECK_FAILED_[a-z0-9-]+)$/.test(message) ? message : 'SETUP_OR_RUNTIME_ERROR_WITHHELD';
}
