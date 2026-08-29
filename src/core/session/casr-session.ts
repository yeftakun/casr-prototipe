export interface CasrSession {
  id: string;
  title: string;
  workspacePath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NativeSessionBinding {
  id: string;
  sessionId: string;
  adapter: string;
  nativeSessionId: string;
  nativePath: string;
  provider: string;
  model: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
