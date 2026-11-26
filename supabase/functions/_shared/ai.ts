// AI provider boundary.
//
// ALL AI calls (LLM, STT, TTS, embeddings) go through this file. Edge Functions
// import `ai` from here and never talk to a provider SDK/API directly. To switch
// away from OpenAI, only the implementation in this file should change.
//
// Types below are placeholders; refine them once the API spec / DB schema exist.

export type AudioInput = Blob | Uint8Array;

export interface TranscribeResult {
  text: string;
}

// deno-lint-ignore no-empty-interface
export interface StudentQuestionContext {}
export interface StudentQuestion {
  question: string;
}

// deno-lint-ignore no-empty-interface
export interface ClassifyConceptsContext {}
export interface ClassifiedConcepts {
  concepts: string[];
}

// deno-lint-ignore no-empty-interface
export interface ReportContext {}
export interface Report {
  summary: string;
}

export interface TtsResult {
  audio: Uint8Array;
  contentType: string;
}

export interface AiProvider {
  /** Speech-to-text. */
  transcribe(audio: AudioInput): Promise<TranscribeResult>;
  /** Generate the AI student's next question. */
  generateStudentQuestion(ctx: StudentQuestionContext): Promise<StudentQuestion>;
  /** Classify concepts covered / missed in a session. */
  classifyConcepts(ctx: ClassifyConceptsContext): Promise<ClassifiedConcepts>;
  /** Generate the learning report. */
  generateReport(ctx: ReportContext): Promise<Report>;
  /** Text embeddings (for pgvector). */
  embed(texts: string[]): Promise<number[][]>;
  /** Text-to-speech. */
  tts(text: string): Promise<TtsResult>;
}

const notImplemented = (method: string): never => {
  throw new Error(`ai.${method}: not implemented`);
};

/** Current provider: OpenAI (not implemented yet). */
export const ai: AiProvider = {
  transcribe: (_audio) => notImplemented("transcribe"),
  generateStudentQuestion: (_ctx) => notImplemented("generateStudentQuestion"),
  classifyConcepts: (_ctx) => notImplemented("classifyConcepts"),
  generateReport: (_ctx) => notImplemented("generateReport"),
  embed: (_texts) => notImplemented("embed"),
  tts: (_text) => notImplemented("tts"),
};
