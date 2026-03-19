export type Step =
  | "greeting"
  | "m1_title"
  | "m1_cond"
  | "m1_subtasks"
  | "m1_time"
  | "m2_ask"
  | "m2_title"
  | "m2_cond"
  | "m2_subtasks"
  | "m2_time"
  | "cp_gen"
  | "interrupt_check"
  | "ifthen_input"
  | "cp_confirm"
  | "focus"
  | "interrupt"
  | "retro";

export type IntSubStep =
  | "type"
  | "whereAt"
  | "hardPart"
  | "nextAction"
  | "done";

export interface Mission {
  title: string;
  cond: string;
  subtasks: string[];
  estimatedHours: string;
}

export interface InterruptItem {
  type: "intrusion" | "distraction" | "internal";
  label: string;
  desc: string;
  if: string;
  checked?: boolean;
}

export interface IfThen {
  if: string;
  then: string;
}

export interface ResumePlan {
  whereAt: string;
  hardPart: string;
  nextAction: string;
}

export interface ChatMessage {
  id: string;
  role: "phare" | "user";
  html: string;
  type?: "summary" | "interrupt-check" | "ifthen" | "resume";
}

export interface ChatState {
  step: Step;
  missions: Mission[];
  interrupts: InterruptItem[];
  selectedInterrupts: InterruptItem[];
  ifthen: IfThen[];
  ifthenIndex: number;
  captureNotes: string[];
  interruptCount: number;
  resumePlan: ResumePlan | null;
  intSubStep: IntSubStep;
  intType: string;
  whereAt: string;
  hardPart: string;
  nextAction: string;
  messages: ChatMessage[];
  quickReplies: string[];
  stepIndex: number;
  showFocus: boolean;
  timerSec: number;
  isLoading: boolean;
}

export const initialState: ChatState = {
  step: "m1_title",
  missions: [],
  interrupts: [],
  selectedInterrupts: [],
  ifthen: [],
  ifthenIndex: 0,
  captureNotes: [],
  interruptCount: 0,
  resumePlan: null,
  intSubStep: "type",
  intType: "",
  whereAt: "",
  hardPart: "",
  nextAction: "",
  messages: [],
  quickReplies: [],
  stepIndex: 0,
  showFocus: false,
  timerSec: 25 * 60,
  isLoading: false,
};

let msgCounter = 0;
export function genId() {
  return `msg-${Date.now()}-${msgCounter++}`;
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function callClaude(
  system: string,
  user: string,
  maxTokens?: number
): Promise<string> {
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user, maxTokens: maxTokens || 800 }),
    });
    const data = await res.json();
    return data.text || "";
  } catch {
    return "";
  }
}

export const typeLabel: Record<string, string> = {
  intrusion: "외부 인터럽트",
  distraction: "주의 분산",
  internal: "내부 잡생각",
};

export const typeColor: Record<string, string> = {
  intrusion: "#D85A30",
  distraction: "#BA7517",
  internal: "#534AB7",
};

export const typeBg: Record<string, string> = {
  intrusion: "#FAECE7",
  distraction: "#FAEEDA",
  internal: "#EEEDFE",
};
