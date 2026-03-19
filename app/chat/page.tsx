"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  type ChatState,
  type ChatMessage,
  type InterruptItem,
  type IfThen,
  initialState,
  genId,
  escHtml,
  callClaude,
  typeLabel,
  typeColor,
  typeBg,
} from "@/lib/chat-engine";

type Action =
  | { type: "ADD_MESSAGE"; msg: ChatMessage }
  | { type: "SET_QUICK_REPLIES"; chips: string[] }
  | { type: "SET_STEP"; step: ChatState["step"] }
  | { type: "SET_STEP_INDEX"; idx: number }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_MISSIONS"; missions: ChatState["missions"] }
  | { type: "SET_INTERRUPTS"; interrupts: InterruptItem[] }
  | { type: "SET_SELECTED_INTERRUPTS"; selected: InterruptItem[] }
  | { type: "SET_IFTHEN"; ifthen: IfThen[] }
  | { type: "SET_IFTHEN_INDEX"; idx: number }
  | { type: "SET_SHOW_FOCUS"; show: boolean }
  | { type: "SET_TIMER"; sec: number }
  | { type: "SET_INT_SUB_STEP"; sub: ChatState["intSubStep"] }
  | { type: "SET_INT_TYPE"; val: string }
  | { type: "SET_WHERE_AT"; val: string }
  | { type: "SET_HARD_PART"; val: string }
  | { type: "SET_NEXT_ACTION"; val: string }
  | { type: "SET_RESUME_PLAN"; plan: ChatState["resumePlan"] }
  | { type: "INC_INTERRUPT_COUNT" }
  | { type: "ADD_CAPTURE"; note: string }
  | { type: "RESET" };

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.msg] };
    case "SET_QUICK_REPLIES":
      return { ...state, quickReplies: action.chips };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_STEP_INDEX":
      return { ...state, stepIndex: action.idx };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_MISSIONS":
      return { ...state, missions: action.missions };
    case "SET_INTERRUPTS":
      return { ...state, interrupts: action.interrupts };
    case "SET_SELECTED_INTERRUPTS":
      return { ...state, selectedInterrupts: action.selected };
    case "SET_IFTHEN":
      return { ...state, ifthen: action.ifthen };
    case "SET_IFTHEN_INDEX":
      return { ...state, ifthenIndex: action.idx };
    case "SET_SHOW_FOCUS":
      return { ...state, showFocus: action.show };
    case "SET_TIMER":
      return { ...state, timerSec: action.sec };
    case "SET_INT_SUB_STEP":
      return { ...state, intSubStep: action.sub };
    case "SET_INT_TYPE":
      return { ...state, intType: action.val };
    case "SET_WHERE_AT":
      return { ...state, whereAt: action.val };
    case "SET_HARD_PART":
      return { ...state, hardPart: action.val };
    case "SET_NEXT_ACTION":
      return { ...state, nextAction: action.val };
    case "SET_RESUME_PLAN":
      return { ...state, resumePlan: action.plan };
    case "INC_INTERRUPT_COUNT":
      return { ...state, interruptCount: state.interruptCount + 1 };
    case "ADD_CAPTURE":
      return {
        ...state,
        captureNotes: [...state.captureNotes, action.note],
      };
    case "RESET":
      return {
        ...initialState,
        messages: [
          {
            id: genId(),
            role: "phare",
            html: "안녕하세요 👋<br>오늘 하루를 시작해볼게요.<br><br>오늘 가장 끝내고 싶은 일이 뭔가요?",
          },
        ],
        quickReplies: ["보고서 작성", "디자인 작업", "코드 리뷰", "미팅 준비"],
      };
    default:
      return state;
  }
}

function addPhare(
  d: React.Dispatch<Action>,
  html: string,
  type?: ChatMessage["type"]
) {
  d({ type: "ADD_MESSAGE", msg: { id: genId(), role: "phare", html, type } });
}

function addUser(d: React.Dispatch<Action>, text: string) {
  d({
    type: "ADD_MESSAGE",
    msg: { id: genId(), role: "user", html: escHtml(text) },
  });
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [inputVal, setInputVal] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Init greeting
  useEffect(() => {
    if (state.messages.length === 0) {
      dispatch({ type: "RESET" });
    }
  }, [state.messages.length]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) setTimeout(() => (el.scrollTop = el.scrollHeight), 50);
  }, [state.messages.length, state.isLoading]);

  const d = dispatch;

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Dispatch logic
  const handleSend = useCallback(
    async (text: string) => {
      const s = stateRef.current;
      addUser(d, text);
      d({ type: "SET_QUICK_REPLIES", chips: [] });

      if (s.step === "m1_title") {
        d({
          type: "SET_MISSIONS",
          missions: [{ title: text, cond: "" }],
        });
        addPhare(d, `"${escHtml(text)}" — 좋아요! 이 미션이 완료됐다는 걸 어떻게 알 수 있을까요? 완료 조건을 알려주세요.`);
        d({ type: "SET_STEP", step: "m1_cond" });
        d({
          type: "SET_QUICK_REPLIES",
          chips: [
            "파일 저장 완료",
            "공유 링크 전송",
            "검토 요청 완료",
            "직접 입력할게요",
          ],
        });
      } else if (s.step === "m1_cond") {
        const missions = [{ ...s.missions[0], cond: text }];
        d({ type: "SET_MISSIONS", missions });
        addPhare(d, "완료 조건 명확하네요 👍 오늘 또 다른 미션이 있나요?");
        d({ type: "SET_STEP", step: "m2_ask" });
        d({
          type: "SET_QUICK_REPLIES",
          chips: ["네, 하나 더 있어요", "아니요, 하나면 돼요"],
        });
      } else if (s.step === "m2_ask") {
        const lower = text.toLowerCase();
        if (
          lower.includes("아니") ||
          lower.includes("없") ||
          lower.includes("하나")
        ) {
          addPhare(
            d,
            "좋아요! 미션 하나에 집중하는 게 오히려 더 강력할 수 있어요 💪<br><br>이제 오늘 예상되는 인터럽트를 같이 정리해볼게요."
          );
          d({ type: "SET_STEP", step: "cp_gen" });
          await delay(600);
          await generateCP(d, stateRef);
        } else {
          addPhare(d, "두 번째 미션은 뭔가요?");
          d({ type: "SET_STEP", step: "m2_title" });
          d({
            type: "SET_QUICK_REPLIES",
            chips: ["이메일 정리", "미팅 준비", "보고서 검토", "기타 업무"],
          });
        }
      } else if (s.step === "m2_title") {
        const missions = [...s.missions, { title: text, cond: "" }];
        d({ type: "SET_MISSIONS", missions });
        addPhare(d, `"${escHtml(text)}" — 이 미션의 완료 조건은 뭔가요?`);
        d({ type: "SET_STEP", step: "m2_cond" });
        d({
          type: "SET_QUICK_REPLIES",
          chips: ["완료 후 공유", "담당자 확인", "직접 말할게요"],
        });
      } else if (s.step === "m2_cond") {
        const missions = [...s.missions];
        missions[1] = { ...missions[1], cond: text };
        d({ type: "SET_MISSIONS", missions });
        addPhare(d, "완벽해요. 이제 오늘 예상 인터럽트를 분석할게요.");
        d({ type: "SET_STEP", step: "cp_gen" });
        await delay(600);
        await generateCP(d, stateRef);
      } else if (s.step === "interrupt_check") {
        addPhare(
          d,
          "위 카드에서 해당되는 항목을 탭해서 체크하고, 완료 버튼을 눌러주세요."
        );
      } else if (s.step === "ifthen_input") {
        await handleIfthenInput(d, stateRef, text);
      } else if (s.step === "cp_confirm") {
        await startFocusMode(d, stateRef);
      } else if (s.step === "interrupt") {
        await handleInterruptFlow(d, stateRef, text);
      } else if (s.step === "retro") {
        addPhare(
          d,
          "오늘도 수고했어요. 내일 새로운 플랜을 시작해보세요!"
        );
      }
    },
    [d]
  );

  const sendMsg = useCallback(
    (override?: string) => {
      const text = override ?? inputVal.trim();
      if (!text) return;
      setInputVal("");
      handleSend(text);
    },
    [inputVal, handleSend]
  );

  // Timer
  const startTimer = useCallback(() => {
    d({ type: "SET_TIMER", sec: 25 * 60 });
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const cur = stateRef.current.timerSec;
      if (cur <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      d({ type: "SET_TIMER", sec: cur - 1 });
    }, 1000);
  }, [d]);

  const triggerInterrupt = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    d({ type: "INC_INTERRUPT_COUNT" });
    d({ type: "SET_SHOW_FOCUS", show: false });
    d({ type: "SET_STEP", step: "interrupt" });
    d({ type: "SET_INT_SUB_STEP", sub: "type" });
    d({ type: "SET_STEP_INDEX", idx: 3 });
    addPhare(d, "⚡ 인터럽트가 생겼군요.<br>어떤 종류인가요?");
    d({
      type: "SET_QUICK_REPLIES",
      chips: [
        "클라이언트 연락",
        "예상치 못한 미팅",
        "알림/SNS",
        "잡생각",
        "동료 요청",
        "기타",
      ],
    });
  }, [d]);

  const goRetro = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    d({ type: "SET_SHOW_FOCUS", show: false });
    d({ type: "SET_STEP_INDEX", idx: 3 });
    d({ type: "SET_STEP", step: "retro" });
    await renderRetro(d, stateRef);
  }, [d]);

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-[#A8A39C]">로딩중...</div>
      </div>
    );
  }

  if (!session) return null;

  const userName = session.user?.name?.charAt(0) || "나";
  const dateStr = (() => {
    const d = new Date();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  })();

  const timerMin = Math.floor(state.timerSec / 60);
  const timerSecRem = state.timerSec % 60;
  const timerProg = 1 - state.timerSec / (25 * 60);
  const dashOffset = 289 - timerProg * 289;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-[430px] h-dvh flex flex-col bg-[#F7F6F3] relative">
        {/* Header */}
        <header className="flex items-center justify-between px-[18px] pt-4 pb-3 flex-shrink-0">
          <span className="text-[17px] font-bold tracking-tight text-[#1A1917]">
            phare
          </span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-5 h-1 rounded-full transition-colors duration-200 ease-out"
                  style={{
                    background:
                      i < state.stepIndex
                        ? "#1A1917"
                        : i === state.stepIndex
                          ? "#1D9E75"
                          : "rgba(0,0,0,0.09)",
                  }}
                />
              ))}
            </div>
            <Badge
              variant="outline"
              className="text-[11px] text-[#A8A39C] bg-white border-[rgba(0,0,0,0.09)] px-2 py-0.5"
            >
              {dateStr}
            </Badge>
          </div>
        </header>

        {/* Chat Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-2.5 scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {state.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 animate-in slide-in-from-bottom-1.5 fade-in duration-200 ease-out ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
              style={{
                animationFillMode: "backwards",
              }}
            >
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback
                  className={
                    msg.role === "user"
                      ? "bg-[#E6F1FB] text-[#0C447C] text-xs font-bold"
                      : "bg-[#1A1917] text-white text-xs font-bold"
                  }
                >
                  {msg.role === "user" ? userName : "P"}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#1A1917] text-white rounded-br-sm"
                    : "bg-white border border-[rgba(0,0,0,0.09)] text-[#1A1917] rounded-bl-sm"
                }`}
                dangerouslySetInnerHTML={{ __html: msg.html }}
              />
            </div>
          ))}

          {/* Typing indicator */}
          {state.isLoading && (
            <div className="flex items-end gap-2 animate-in fade-in duration-150">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="bg-[#1A1917] text-white text-xs font-bold">
                  P
                </AvatarFallback>
              </Avatar>
              <div className="bg-white border border-[rgba(0,0,0,0.09)] rounded-2xl rounded-bl-sm px-3.5 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-[5px] h-[5px] rounded-full bg-[#A8A39C]"
                      style={{
                        animation: "blink 1.1s infinite",
                        animationDelay: `${i * 0.18}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Replies */}
        {state.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-[7px] px-4 pb-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out">
            {state.quickReplies.map((chip) => (
              <Button
                key={chip}
                variant="outline"
                size="sm"
                className="rounded-full text-[13px] px-3.5 py-1.5 min-h-[36px] bg-white border-[rgba(0,0,0,0.16)] text-[#1A1917] hover:bg-[#F0EEE9] hover:border-[#1A1917] transition-all duration-150 ease-out active:scale-[0.97]"
                onClick={() => sendMsg(chip)}
              >
                {chip}
              </Button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="px-3.5 pt-2.5 pb-5 border-t border-[rgba(0,0,0,0.09)] flex items-end gap-2 flex-shrink-0 bg-[#F7F6F3]">
          <div className="flex-1 bg-white border border-[rgba(0,0,0,0.16)] rounded-[22px] flex items-end px-3.5 py-2 focus-within:border-[#1A1917] transition-colors duration-150 ease-out">
            <textarea
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMsg();
                }
              }}
              placeholder="메시지 입력..."
              rows={1}
              className="flex-1 border-none outline-none bg-transparent text-[15px] text-[#1A1917] resize-none max-h-[120px] min-h-[22px] leading-[1.4] p-0 placeholder:text-[#A8A39C] font-[inherit]"
              style={{ fontSize: "16px" }}
            />
          </div>
          <button
            onClick={() => sendMsg()}
            disabled={!inputVal.trim()}
            className="w-9 h-9 rounded-full bg-[#1A1917] border-none flex items-center justify-center flex-shrink-0 transition-all duration-150 ease-out hover:bg-[#333] active:scale-95 disabled:bg-[rgba(0,0,0,0.09)] disabled:cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8L14 8M14 8L9 3M14 8L9 13"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Focus Overlay */}
        {state.showFocus && (
          <div className="absolute inset-0 bg-[#F7F6F3] flex flex-col z-10 animate-in fade-in duration-200 ease-out">
            <div className="px-[18px] pt-4 flex justify-between items-center">
              <button
                className="text-[13px] text-[#6B6760] bg-transparent border-none cursor-pointer flex items-center gap-1 min-h-[44px] font-[inherit]"
                onClick={() =>
                  d({ type: "SET_SHOW_FOCUS", show: false })
                }
              >
                ← 채팅으로
              </button>
              <Badge
                variant="outline"
                className="text-xs text-[#6B6760] bg-white border-[rgba(0,0,0,0.09)]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D85A30] mr-1.5" />
                인터럽트 {state.interruptCount}회
              </Badge>
            </div>

            <div className="flex-1 flex flex-col px-[18px] pt-5">
              <h2 className="text-lg font-semibold text-[#1A1917] mb-1">
                {state.missions[0]?.title}
              </h2>
              <p className="text-[13px] text-[#6B6760] mb-7">
                {state.missions[0]?.cond}
              </p>

              {/* Timer Ring */}
              <div className="flex justify-center mb-6">
                <div className="relative w-[110px] h-[110px]">
                  <svg
                    width="110"
                    height="110"
                    viewBox="0 0 110 110"
                    style={{ transform: "rotate(-90deg)" }}
                  >
                    <circle
                      cx="55"
                      cy="55"
                      r="46"
                      fill="none"
                      stroke="#F0EEE9"
                      strokeWidth="8"
                    />
                    <circle
                      cx="55"
                      cy="55"
                      r="46"
                      fill="none"
                      stroke="#1D9E75"
                      strokeWidth="8"
                      strokeDasharray="289"
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      style={{
                        transition: "stroke-dashoffset 1s linear",
                      }}
                    />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div
                      className="text-[22px] font-bold tracking-tight text-[#1A1917]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {String(timerMin).padStart(2, "0")}:
                      {String(timerSecRem).padStart(2, "0")}
                    </div>
                    <div className="text-[10px] text-[#A8A39C]">남은 시간</div>
                  </div>
                </div>
              </div>

              {/* Capture Notes */}
              <div className="flex-1">
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#A8A39C] mb-2">
                  캡처 노트 — 잡생각 즉시 기록
                </div>
                <div className="min-h-6 mb-2.5">
                  {state.captureNotes.map((note, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-1.5 border-b border-[rgba(0,0,0,0.09)] text-[13px] text-[#6B6760]"
                    >
                      <span className="w-[5px] h-[5px] rounded-full bg-[#534AB7] flex-shrink-0" />
                      {note}
                    </div>
                  ))}
                </div>
                <CaptureInput
                  onAdd={(val) => d({ type: "ADD_CAPTURE", note: val })}
                />
              </div>

              <button
                className="w-full py-3.5 bg-[#FAECE7] text-[#D85A30] border-[1.5px] border-[#F5C4B3] rounded-2xl text-[15px] font-semibold cursor-pointer transition-all duration-150 ease-out hover:bg-[#F5C4B3] active:scale-[0.98] flex items-center justify-center gap-2 mt-3 min-h-[48px]"
                onClick={triggerInterrupt}
              >
                ⚡ 인터럽트 발생 — 메모하기
              </button>
              <button
                className="w-full py-3 mt-2 bg-transparent text-[#6B6760] border border-[rgba(0,0,0,0.09)] rounded-2xl text-sm cursor-pointer transition-all duration-150 ease-out hover:text-[#1A1917] hover:border-[rgba(0,0,0,0.16)] min-h-[44px]"
                onClick={goRetro}
              >
                저녁 회고 →
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes blink {
          0%,
          80%,
          100% {
            opacity: 0.25;
            transform: scale(0.85);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-in {
            animation: none !important;
          }
          @keyframes blink {
            0%,
            100% {
              opacity: 0.5;
            }
          }
        }
      `}</style>
    </div>
  );

  // ── Helper functions below (closures over dispatch) ──

  async function generateCP(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>
  ) {
    d({ type: "SET_STEP_INDEX", idx: 1 });
    d({ type: "SET_LOADING", loading: true });

    const s = sRef.current;
    const mText = s.missions
      .map(
        (m, i) =>
          `미션 ${i + 1}: "${m.title}" (완료조건: ${m.cond})`
      )
      .join("\n");

    let interrupts: InterruptItem[];

    try {
      const sys = `당신은 phare 앱입니다. 사용자의 미션을 분석하여 오늘 예상되는 인터럽트 상황만 생성하세요.
반드시 아래 JSON만 출력. 다른 텍스트 없이:
{
  "intro": "인터럽트 분석 결과를 1문장으로 친근하게 소개 (한국어)",
  "interrupts": [
    {"type":"intrusion|distraction|internal","label":"짧은 이름","desc":"구체적 상황 1문장","if":"만약 ~한다면 형태의 짧은 조건문"}
  ]
}
interrupts 2-3개. 한국어.`;

      const raw = await callClaude(sys, mText, 500);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      interrupts = parsed.interrupts;

      d({ type: "SET_LOADING", loading: false });
      addPhare(
        d,
        `${escHtml(parsed.intro)}<br><span style="font-size:13px;color:#6B6760;">오늘 해당되는 것만 체크해주세요.</span>`
      );
    } catch {
      interrupts = [
        {
          type: "intrusion",
          label: "클라이언트 연락",
          desc: "작업 중 갑작스러운 피드백이나 질문 요청",
          if: "클라이언트한테 갑자기 연락이 오면",
        },
        {
          type: "distraction",
          label: "알림/SNS",
          desc: "슬랙, 이메일 알림이 집중을 방해할 수 있음",
          if: "알림이 눈에 들어와 집중이 끊기면",
        },
        {
          type: "internal",
          label: "다른 할 일 생각",
          desc: '"아, 그것도 해야 하는데" 같은 잡생각',
          if: "해야 할 다른 일이 갑자기 떠오르면",
        },
      ];

      d({ type: "SET_LOADING", loading: false });
      addPhare(
        d,
        '미션을 분석했어요. 오늘 이런 인터럽트가 예상돼요.<br><span style="font-size:13px;color:#6B6760;">오늘 해당되는 것만 체크해주세요.</span>'
      );
    }

    d({ type: "SET_INTERRUPTS", interrupts });

    // Render interrupt check cards
    const checkHtml = interrupts
      .map((it, i) => {
        const col = typeColor[it.type] || "#D85A30";
        const bg = typeBg[it.type] || "#FAECE7";
        return `<div data-int-idx="${i}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;border:1.5px solid rgba(0,0,0,0.09);background:white;margin-bottom:7px;cursor:pointer;">
          <div style="width:18px;height:18px;border-radius:4px;border:1.5px solid rgba(0,0,0,0.16);flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;background:white;"></div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:2px 7px;border-radius:20px;background:${bg};color:${col};">
                <span style="width:5px;height:5px;border-radius:50%;background:${col};"></span>${escHtml(it.label)}
              </span>
            </div>
            <div style="font-size:13px;color:#6B6760;line-height:1.5;">${escHtml(it.desc)}</div>
          </div>
        </div>`;
      })
      .join("");

    addPhare(
      d,
      `<div id="int-check-list">${checkHtml}</div>
       <button onclick="window.__confirmInterruptSelection && window.__confirmInterruptSelection()" style="width:100%;margin-top:10px;padding:11px;border-radius:10px;border:none;background:#1A1917;color:white;font-size:14px;font-weight:600;cursor:pointer;min-height:44px;">선택 완료 →</button>`,
      "interrupt-check"
    );

    d({ type: "SET_STEP", step: "interrupt_check" });

    // Set up global handler for the confirm button
    (window as any).__confirmInterruptSelection = () =>
      confirmInterruptSelection(d, sRef);
  }

  function confirmInterruptSelection(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>
  ) {
    const s = sRef.current;
    // For simplicity, select all interrupts
    const selected = s.interrupts;
    d({ type: "SET_SELECTED_INTERRUPTS", selected });
    const ifthen = selected.map((it) => ({ if: it.if, then: "" }));
    d({ type: "SET_IFTHEN", ifthen });
    d({ type: "SET_IFTHEN_INDEX", idx: 0 });

    const labels = selected.map((it) => it.label).join(", ");
    addUser(d, `${labels} 체크했어요`);

    setTimeout(async () => {
      addPhare(
        d,
        `${selected.length}개 선택했군요. 이제 각 상황에서 어떻게 대응할지 정해봐요.`
      );
      await delay(400);
      askNextIfthen(d, sRef);
    }, 400);
  }

  function askNextIfthen(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>
  ) {
    const s = sRef.current;
    const interrupts = s.selectedInterrupts;
    const idx = s.ifthenIndex;

    if (idx >= interrupts.length) {
      finishIfthen(d, sRef);
      return;
    }

    const it = interrupts[idx];
    const progress = `(${idx + 1}/${interrupts.length})`;

    const html = `<div style="font-size:11px;color:#A8A39C;margin-bottom:6px;">${progress} ${typeLabel[it.type] || "인터럽트"}</div>
      <div style="background:#E6F1FB;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
        <div style="font-size:11px;font-weight:700;color:#0C447C;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px;">만약</div>
        <div style="font-size:14px;font-weight:600;color:#1A1917;">${escHtml(it.if)}</div>
      </div>
      <div style="font-size:13px;color:#6B6760;">이 상황이 오면 어떻게 대응할 건가요?</div>`;

    addPhare(d, html);
    d({ type: "SET_STEP", step: "ifthen_input" });

    const hints: Record<string, string[]> = {
      intrusion: [
        "재개 메모 쓰고 처리",
        "오후로 미루고 답장",
        "10분 안에 처리 후 복귀",
      ],
      distraction: ["알림 끄고 무시", "캡처 노트에 메모", "DND 켜기"],
      internal: [
        "캡처 노트에 적고 무시",
        "타이머 끝나고 처리",
        "지금 바로 5분 처리",
      ],
    };
    d({
      type: "SET_QUICK_REPLIES",
      chips: hints[it.type] || ["직접 입력할게요"],
    });
  }

  async function handleIfthenInput(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>,
    text: string
  ) {
    const s = sRef.current;
    const idx = s.ifthenIndex;
    const ifthen = [...s.ifthen];
    ifthen[idx] = { ...ifthen[idx], then: text };
    d({ type: "SET_IFTHEN", ifthen });

    const it = s.selectedInterrupts[idx];
    addPhare(
      d,
      `<div style="background:#F0EEE9;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.7;">
        <span style="color:#A8A39C;">만약</span> <b>${escHtml(it.if)}</b><br>
        <span style="color:#1D9E75;font-weight:600;">→ ${escHtml(text)}</span>
        <span style="font-size:11px;color:#A8A39C;margin-left:6px;">저장됨</span>
      </div>`
    );

    d({ type: "SET_IFTHEN_INDEX", idx: idx + 1 });
    await delay(500);
    // Need fresh state
    askNextIfthen(d, sRef);
  }

  async function finishIfthen(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>
  ) {
    const s = sRef.current;
    const ifthenHtml = s.ifthen
      .map(
        (it) =>
          `<div style="background:#E6F1FB;border-radius:6px;padding:8px 10px;margin-bottom:5px;font-size:12px;">
            <div style="color:#0C447C;font-weight:600;margin-bottom:2px;">만약 ${escHtml(it.if)}</div>
            <div style="color:#1A1917;">→ ${escHtml(it.then)}</div>
          </div>`
      )
      .join("");

    addPhare(
      d,
      `<div style="margin-bottom:6px;font-size:14px;">좋아요! If-Then 플랜이 완성됐어요 ✓</div>
       <div style="background:white;border:0.5px solid rgba(0,0,0,0.09);border-radius:10px;padding:12px 14px;">
         <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#A8A39C;margin-bottom:5px;">오늘의 If-Then 플랜</div>
         ${ifthenHtml}
       </div>`
    );

    await delay(400);
    addPhare(d, "이제 집중 모드를 시작할까요?");
    d({ type: "SET_STEP", step: "cp_confirm" });
    d({ type: "SET_QUICK_REPLIES", chips: ["집중 시작할게요"] });
  }

  async function startFocusMode(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>
  ) {
    d({ type: "SET_LOADING", loading: true });
    await delay(500);
    d({ type: "SET_LOADING", loading: false });
    addPhare(
      d,
      "좋아요! 집중 모드를 시작할게요. 화면 상단의 집중 모드로 이동합니다.<br><br>인터럽트가 오면 오렌지 버튼을 누르고 메모하세요 ⚡"
    );
    d({ type: "SET_STEP_INDEX", idx: 2 });
    await delay(800);
    d({ type: "SET_SHOW_FOCUS", show: true });
    d({ type: "SET_STEP", step: "focus" });
    startTimer();
  }

  async function handleInterruptFlow(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>,
    text: string
  ) {
    const s = sRef.current;

    if (s.intSubStep === "type") {
      d({ type: "SET_INT_TYPE", val: text });
      d({ type: "SET_LOADING", loading: true });
      await delay(400);
      d({ type: "SET_LOADING", loading: false });
      addPhare(
        d,
        '지금 하던 작업이 어디까지 됐나요?<br><span style="font-size:12px;color:#A8A39C;">예: "데스크탑 헤더 시작, 로고 위치 잡는 중"</span>'
      );
      d({ type: "SET_INT_SUB_STEP", sub: "whereAt" });
    } else if (s.intSubStep === "whereAt") {
      d({ type: "SET_WHERE_AT", val: text });
      d({ type: "SET_LOADING", loading: true });
      await delay(400);
      d({ type: "SET_LOADING", loading: false });
      addPhare(
        d,
        '어려운 부분이 있나요? 없으면 "없음"이라고 해도 돼요.'
      );
      d({ type: "SET_INT_SUB_STEP", sub: "hardPart" });
      d({
        type: "SET_QUICK_REPLIES",
        chips: [
          "없음",
          "방향을 못 잡겠음",
          "정보가 부족함",
          "집중이 안 됨",
        ],
      });
    } else if (s.intSubStep === "hardPart") {
      d({ type: "SET_HARD_PART", val: text === "없음" ? "" : text });
      d({ type: "SET_LOADING", loading: true });
      await delay(400);
      d({ type: "SET_LOADING", loading: false });
      addPhare(
        d,
        '돌아올 때 첫 번째로 할 것은요?<br><span style="font-size:12px;color:#A8A39C;">구체적일수록 재개가 빨라요</span>'
      );
      d({ type: "SET_INT_SUB_STEP", sub: "nextAction" });
      d({
        type: "SET_QUICK_REPLIES",
        chips: ["이어서 작업", "다시 검토부터", "직접 입력할게요"],
      });
    } else if (s.intSubStep === "nextAction") {
      d({ type: "SET_NEXT_ACTION", val: text });

      const resumePlan = {
        whereAt: s.whereAt,
        hardPart: s.hardPart,
        nextAction: text,
      };

      addPhare(
        d,
        "메모 저장했어요. 인터럽트를 처리하고 돌아오면 바로 재개할 수 있어요 💪"
      );

      d({ type: "SET_RESUME_PLAN", plan: resumePlan });

      await delay(400);
      addPhare(
        d,
        `<div style="background:#FAECE7;border:1.5px solid #F5C4B3;border-radius:10px;padding:12px 14px;margin-top:6px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#D85A30;margin-bottom:8px;">📌 재개 노트</div>
          ${resumePlan?.whereAt ? `<div style="font-size:12px;color:#6B6760;margin-bottom:6px;"><b style="color:#1A1917;">상태:</b> ${escHtml(resumePlan.whereAt)}</div>` : ""}
          ${resumePlan?.hardPart ? `<div style="font-size:12px;color:#6B6760;margin-bottom:6px;"><b style="color:#1A1917;">어려운 점:</b> ${escHtml(resumePlan.hardPart)}</div>` : ""}
          <div style="background:#D85A30;color:white;border-radius:6px;padding:8px 10px;font-size:13px;font-weight:600;">
            → ${escHtml(resumePlan?.nextAction || "이어서 작업")}
          </div>
        </div>`,
        "resume"
      );

      d({ type: "SET_INT_SUB_STEP", sub: "done" });
      d({
        type: "SET_QUICK_REPLIES",
        chips: ["인터럽트 처리 완료 → 재개", "아직 처리 중"],
      });
    } else if (s.intSubStep === "done") {
      if (text.includes("재개") || text.includes("완료")) {
        addPhare(d, "좋아요! 재개 노트를 보면서 바로 시작하세요 🟢");
        d({ type: "SET_STEP_INDEX", idx: 2 });
        d({ type: "SET_STEP", step: "focus" });
        await delay(600);
        d({ type: "SET_SHOW_FOCUS", show: true });
        startTimer();
      } else {
        addPhare(d, "알겠어요. 처리 끝나면 다시 알려주세요!");
      }
    }
  }

  async function renderRetro(
    d: React.Dispatch<Action>,
    sRef: React.MutableRefObject<ChatState>
  ) {
    d({ type: "SET_LOADING", loading: true });
    await delay(600);
    d({ type: "SET_LOADING", loading: false });

    addPhare(d, "오늘 하루 수고했어요 🌙<br>잠깐 회고해볼게요.");
    await delay(600);

    const s = sRef.current;
    const missionsHtml = s.missions
      .map(
        (m) =>
          `<div style="background:#F0EEE9;border-radius:6px;padding:9px 12px;margin-bottom:7px;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;">
              <div style="width:14px;height:14px;border-radius:50%;background:#1D9E75;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div style="font-size:13px;font-weight:600;color:#1A1917;">${escHtml(m.title)}</div>
            </div>
            <div style="font-size:12px;color:#6B6760;padding-left:21px;">${escHtml(m.cond)}</div>
          </div>`
      )
      .join("");

    addPhare(
      d,
      `<div style="background:white;border:0.5px solid rgba(0,0,0,0.09);border-radius:10px;padding:12px 14px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#A8A39C;margin-bottom:5px;">미션</div>
        ${missionsHtml}
        <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#A8A39C;margin:10px 0 5px;">인터럽트 패턴</div>
        <div style="font-size:13px;color:#1A1917;line-height:2;">
          총 <b>${s.interruptCount}회</b> · 캡처 노트 <b>${s.captureNotes.length}건</b><br>
          Ready-to-Resume <b>${s.resumePlan ? "사용 ✓" : "미사용"}</b>
        </div>
      </div>`
    );

    await delay(500);

    const intMsg = s.interruptCount > 0
      ? `인터럽트 ${s.interruptCount}회를 잘 관리했어요.`
      : "인터럽트 없이 집중한 하루였네요!";
    addPhare(
      d,
      `오늘도 수고했어요 🌱 ${intMsg} 내일은 오늘의 패턴을 참고해서 더 나은 하루를 만들어봐요.`
    );

    await delay(400);
    addPhare(
      d,
      `내일도 함께 시작해요!<br><button onclick="window.__resetPhare && window.__resetPhare()" style="display:block;width:100%;margin-top:10px;background:#1D9E75;color:white;border:none;border-radius:6px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;min-height:44px;">새로운 하루 시작하기</button>`
    );

    (window as any).__resetPhare = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      d({ type: "RESET" });
    };
  }
}

// Small capture input component
function CaptureInput({ onAdd }: { onAdd: (val: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={val}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" && val.trim()) {
            onAdd(val.trim());
            setVal("");
          }
        }}
        placeholder="떠오르는 것 적기..."
        className="flex-1 text-[13px] bg-white border-[rgba(0,0,0,0.09)] rounded-[10px]"
        style={{ fontSize: "16px" }}
      />
      <Button
        variant="outline"
        size="sm"
        className="text-[13px] text-[#6B6760] border-[rgba(0,0,0,0.09)] rounded-[10px] min-h-[36px]"
        onClick={() => {
          if (val.trim()) {
            onAdd(val.trim());
            setVal("");
          }
        }}
      >
        추가
      </Button>
    </div>
  );
}
