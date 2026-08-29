export interface NativeSession {
  adapter: string;
  nativeSessionId: string;
  title: string;
  workspacePath: string;
  nativePath: string;
  provider: string;
  model: string | null;
  reasoningEffort: string | null;
  source: string;
  threadSource: string | null;
  historyMode: string;
  projectId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
