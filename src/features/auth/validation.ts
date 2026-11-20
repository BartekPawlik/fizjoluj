export const MIN_PASSWORD_LENGTH = 12;

export function readString(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

export function readEmail(form: FormData) {
  const email = readString(form, "email").trim().toLowerCase();
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

export function readNewPassword(form: FormData) {
  const password = readString(form, "password");
  if (password.length < MIN_PASSWORD_LENGTH || new TextEncoder().encode(password).length > 72) return null;
  return password === readString(form, "passwordConfirmation") ? password : null;
}

export function readConfirmation(token: unknown, type: unknown) {
  if (typeof token !== "string" || !/^[a-z\d_-]{16,256}$/i.test(token)) return null;
  if (type !== "email" && type !== "recovery") return null;
  return { token_hash: token, type } as const;
}

export function readUuid(form: FormData, field: string) {
  const value = readString(form, field);
  return isUuid(value) ? value : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
}

export function readPage(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
}
