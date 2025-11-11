export type Post = {
  post_id: string;
  author: string | null;
  character_display_name: string | null;
  character_handle: string | null;
  icon_url: string | null;
  timestamp: string | null;
  content: string;
};

export type Thread = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  posts: Post[];
  authors: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type Section = {
  id: string;
  title: string | null;
  description: string | null;
  threads: Thread[];
};

export type Board = {
  id: string;
  title: string;
  description: string | null;
  sections: Section[];
  threads: Thread[];
};

export type BookStructure =
  | { kind: "thread"; thread: Thread }
  | { kind: "section"; section: Section }
  | { kind: "board"; board: Board };

export const GLOWFIC_ROOT = "https://glowfic.com";
