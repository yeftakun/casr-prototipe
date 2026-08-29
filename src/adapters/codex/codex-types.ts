export interface CodexThreadRow {
  id: string;
  title: string;
  cwd: string;
  model_provider: string;
  model: string | null;
  reasoning_effort: string | null;
  rollout_path: string;
  source: string;
  thread_source: string | null;
  history_mode: string;
  project_id: string | null;
  archived: number;
  created_at: number;
  updated_at: number;
}
