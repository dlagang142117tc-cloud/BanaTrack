export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message, or null when the new password is acceptable. */
export function passwordError(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) {
    return "Passwords do not match.";
  }
  return null;
}
