/**
 * The one `AppError.code` a signed-in surface has to recognise on the wire:
 * the session is gone. Named here, beside the sentence it carries, so the
 * server that raises it and the client that reads it spell it once.
 */
export const SESSION_REQUIRED_CODE = "session_required";
