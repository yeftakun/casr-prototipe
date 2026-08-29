export interface SessionListItem {
  id: string;
  title: string;
  workspacePath: string;
  status: string;
  adapter: string;
  updatedAt: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  workspacePath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  nativeBinding: {
    adapter: string;
    nativeSessionId: string;
    nativePath: string;
    provider: string;
    model: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
}
