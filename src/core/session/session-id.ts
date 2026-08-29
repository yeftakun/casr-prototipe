import { v7 as uuidv7 } from "uuid";

export function createCasrSessionId(): string {
  return `casr_${uuidv7()}`;
}

export function createNativeBindingId(): string {
  return `binding_${uuidv7()}`;
}
