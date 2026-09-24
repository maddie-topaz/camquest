// Quest play as a state machine. One quest, one run: which step, what's
// answered, which passcodes are unlocked, whether a mystery card has been
// turned over. Persistence and completion leave the machine as emitted
// events, so the machine stays pure and the React side decides what a
// "progress" event means (a quest.progress command).
//
// States:
//   locked      the save doesn't meet the quest's requirements (final)
//   step.gated  the current step has a passcode that hasn't been entered,
//               or a world trigger (e.g. a terminal press) that hasn't
//               happened; SYNC_UNLOCKS brings in server-side unlocks
//   step.open   choosing (answer not committed) or revealed (mystery card
//               turned over / confirm pressed)
//   completing  waiting for the React side to record the completion
//   done        (final)

import { assign, emit, setup, type SnapshotFrom } from "xstate";
import type { ChallengeStep } from "../content/quests";
import type { QuestDefinition } from "../content/quests";
import { canStartQuest } from "../rules";
import type { QuestSave, Requirements, SaveFile } from "../types";

export const START_UNLOCK_ID = "__start__";

export type QuestProgress = {
  step: number;
  answers: Record<string, string>;
  unlockedSteps: string[];
};

export type QuestMachineInput = {
  quest: QuestDefinition;
  save: SaveFile;
  // The quest's saved progress; a completed quest replays from the top.
  saved?: QuestSave;
  completed: boolean;
};

export type QuestContext = {
  quest: QuestDefinition;
  missing: Requirements;
  stepIndex: number;
  answers: Record<string, string>;
  unlockedSteps: string[];
  // The working answer for the current step (committed into `answers` on
  // select for choices, on NEXT for riddles).
  answer: string;
  passcodeInput: string;
  passcodeError: boolean;
};

export type QuestEvent =
  | { type: "SELECT"; value: string }
  // The step's mini-game reported a result (already recorded server-side).
  | { type: "ENCOUNTER_RESULT"; score: number; reward?: string }
  | { type: "TYPE_ANSWER"; value: string }
  | { type: "TYPE_PASSCODE"; value: string }
  | { type: "SUBMIT_PASSCODE" }
  | { type: "REVEAL" }
  | { type: "NEXT" }
  | { type: "COMPLETED" }
  | { type: "COMPLETION_FAILED" }
  // The server's unlock list for this quest, e.g. after a terminal press
  // opened a checkpoint. Merged in; never removes a local unlock.
  | { type: "SYNC_UNLOCKS"; unlockedSteps: string[] };

export type QuestEmitted =
  | { type: "progress"; progress: QuestProgress }
  | { type: "complete"; answers: Record<string, string> }
  | { type: "cue"; cue: string; detail?: Record<string, unknown> };

const currentStep = (context: QuestContext): ChallengeStep | undefined =>
  context.quest.steps[context.stepIndex];

const normalise = (value: string | undefined) =>
  (value ?? "").trim().toUpperCase();

const progressOf = (context: QuestContext): QuestProgress => ({
  step: context.stepIndex,
  answers: context.answers,
  unlockedSteps: context.unlockedSteps,
});

export const questMachine = setup({
  types: {
    context: {} as QuestContext,
    events: {} as QuestEvent,
    input: {} as QuestMachineInput,
    emitted: {} as QuestEmitted,
  },
  guards: {
    questLocked: ({ context }) => Object.keys(context.missing).length > 0,
    stepGated: ({ context }) => {
      const step = currentStep(context);
      return (
        Boolean(step?.passcode || step?.trigger) &&
        !context.unlockedSteps.includes(step!.id)
      );
    },
    syncOpensStep: ({ context, event }) => {
      const step = currentStep(context);
      return (
        event.type === "SYNC_UNLOCKS" &&
        Boolean(step) &&
        event.unlockedSteps.includes(step!.id)
      );
    },
    // A restored mystery answer, or an encounter already played, comes
    // back already turned over.
    stepAlreadyRevealed: ({ context }) => {
      const type = currentStep(context)?.type;
      return (
        (type === "mystery" || type === "encounter") && Boolean(context.answer)
      );
    },
    // A trigger-only step has no passcode, and an empty guess must not
    // "match" it.
    passcodeMatches: ({ context }) => {
      const passcode = currentStep(context)?.passcode;
      return (
        Boolean(passcode) &&
        normalise(context.passcodeInput) === normalise(passcode)
      );
    },
    isLastStep: ({ context }) =>
      context.stepIndex >= context.quest.steps.length - 1,
    canAdvance: ({ context }) => {
      const step = currentStep(context);
      if (!step) return false;
      if (
        step.type === "choice" ||
        step.type === "mystery" ||
        step.type === "encounter"
      )
        return Boolean(context.answer);
      if (step.type === "riddle")
        return context.answer.trim().toLowerCase() === step.answer;
      return true;
    },
  },
  actions: {
    unlockStep: assign(({ context }) => {
      const step = currentStep(context)!;
      return {
        unlockedSteps: context.unlockedSteps.includes(step.id)
          ? context.unlockedSteps
          : [...context.unlockedSteps, step.id],
        passcodeInput: "",
        passcodeError: false,
      };
    }),
    mergeUnlocks: assign({
      unlockedSteps: ({ context, event }) =>
        event.type === "SYNC_UNLOCKS"
          ? [
              ...context.unlockedSteps,
              ...event.unlockedSteps.filter(
                (id) => !context.unlockedSteps.includes(id),
              ),
            ]
          : context.unlockedSteps,
    }),
    rejectPasscode: assign({ passcodeError: true }),
    typePasscode: assign({
      passcodeInput: ({ event }) =>
        event.type === "TYPE_PASSCODE" ? event.value : "",
      passcodeError: false,
    }),
    typeAnswer: assign({
      answer: ({ event }) => (event.type === "TYPE_ANSWER" ? event.value : ""),
    }),
    selectAnswer: assign(({ context, event }) => {
      if (event.type !== "SELECT") return {};
      const step = currentStep(context)!;
      return {
        answer: event.value,
        answers: { ...context.answers, [step.id]: event.value },
      };
    }),
    // An encounter's answer is its score, so the archive can show it and a
    // reload treats the step as done.
    recordEncounter: assign(({ context, event }) => {
      if (event.type !== "ENCOUNTER_RESULT") return {};
      const step = currentStep(context)!;
      const value = String(event.score);
      return {
        answer: value,
        answers: { ...context.answers, [step.id]: value },
      };
    }),
    // Commit the working answer and move to the next step, restoring any
    // answer already saved for it.
    advance: assign(({ context }) => {
      const step = currentStep(context)!;
      const answers = context.answer
        ? { ...context.answers, [step.id]: context.answer }
        : context.answers;
      const stepIndex = context.stepIndex + 1;
      return {
        answers,
        stepIndex,
        answer: answers[context.quest.steps[stepIndex]?.id] ?? "",
        passcodeInput: "",
        passcodeError: false,
      };
    }),
    commitAnswer: assign(({ context }) => {
      const step = currentStep(context)!;
      return {
        answers: context.answer
          ? { ...context.answers, [step.id]: context.answer }
          : context.answers,
      };
    }),
    emitProgress: emit(({ context }) => ({
      type: "progress" as const,
      progress: progressOf(context),
    })),
    cue: emit((_, params: { cue: string }) => ({
      type: "cue" as const,
      cue: params.cue,
    })),
    emitComplete: emit(({ context }) => ({
      type: "complete" as const,
      answers: context.answers,
    })),
  },
}).createMachine({
  id: "quest",
  context: ({ input }) => {
    const restored = input.completed ? undefined : input.saved;
    const stepIndex = Math.min(
      restored?.step ?? 0,
      Math.max(0, input.quest.steps.length - 1),
    );
    const answers = restored?.answers ?? {};
    return {
      quest: input.quest,
      missing: canStartQuest(input.save, input.quest).missing,
      stepIndex,
      answers,
      unlockedSteps: restored?.unlockedSteps ?? [],
      answer: answers[input.quest.steps[stepIndex]?.id] ?? "",
      passcodeInput: "",
      passcodeError: false,
    };
  },
  initial: "deciding",
  on: {
    SYNC_UNLOCKS: { actions: "mergeUnlocks" },
  },
  states: {
    deciding: {
      always: [{ guard: "questLocked", target: "locked" }, { target: "step" }],
    },
    locked: { type: "final" },
    step: {
      initial: "deciding",
      states: {
        deciding: {
          always: [
            { guard: "stepGated", target: "gated" },
            { guard: "stepAlreadyRevealed", target: "open.revealed" },
            { target: "open" },
          ],
        },
        gated: {
          on: {
            // Already saved server-side, so no progress event here.
            SYNC_UNLOCKS: [
              {
                guard: "syncOpensStep",
                actions: [
                  "mergeUnlocks",
                  { type: "cue", params: { cue: "checkpoint-unlocked" } },
                ],
                target: "open",
              },
              { actions: "mergeUnlocks" },
            ],
            TYPE_PASSCODE: { actions: "typePasscode" },
            SUBMIT_PASSCODE: [
              {
                guard: "passcodeMatches",
                actions: [
                  "unlockStep",
                  "emitProgress",
                  { type: "cue", params: { cue: "checkpoint-unlocked" } },
                ],
                target: "open",
              },
              {
                actions: [
                  "rejectPasscode",
                  { type: "cue", params: { cue: "checkpoint-denied" } },
                ],
              },
            ],
          },
        },
        open: {
          initial: "choosing",
          states: {
            choosing: {
              on: {
                SELECT: {
                  actions: [
                    "selectAnswer",
                    "emitProgress",
                    { type: "cue", params: { cue: "choice-select" } },
                  ],
                },
                TYPE_ANSWER: { actions: "typeAnswer" },
                REVEAL: {
                  target: "revealed",
                  actions: { type: "cue", params: { cue: "choice-locked" } },
                },
                ENCOUNTER_RESULT: {
                  actions: ["recordEncounter", "emitProgress"],
                  target: "revealed",
                },
              },
            },
            revealed: {},
          },
          on: {
            NEXT: [
              {
                guard: "isLastStep",
                actions: [
                  "commitAnswer",
                  { type: "cue", params: { cue: "quest-complete" } },
                ],
                target: "#quest.completing",
              },
              {
                guard: "canAdvance",
                actions: [
                  "advance",
                  "emitProgress",
                  { type: "cue", params: { cue: "step-advance" } },
                ],
                target: "deciding",
              },
            ],
          },
        },
      },
    },
    completing: {
      entry: "emitComplete",
      on: {
        COMPLETED: "done",
        // The completion command was rejected or failed; the player still
        // reaches the completion screen, which reads the save.
        COMPLETION_FAILED: "done",
      },
    },
    done: { type: "final" },
  },
});

// ---------------------------------------------------------------------------
// Selectors: what the screen needs, derived from a snapshot. Kept here so
// tests can assert the same answers the UI renders.
// ---------------------------------------------------------------------------

export type QuestSnapshot = SnapshotFrom<typeof questMachine>;
type Snapshot = QuestSnapshot;

export const questSelectors = {
  step: (snapshot: Snapshot) => currentStep(snapshot.context),
  isGated: (snapshot: Snapshot) => snapshot.matches({ step: "gated" }),
  isRevealed: (snapshot: Snapshot) =>
    snapshot.matches({ step: { open: "revealed" } }),
  isLastStep: (snapshot: Snapshot) =>
    snapshot.context.stepIndex >= snapshot.context.quest.steps.length - 1,
  selectedCard: (snapshot: Snapshot) => {
    const step = currentStep(snapshot.context);
    return step?.type === "mystery"
      ? step.cards.find((card) => card.label === snapshot.context.answer)
      : undefined;
  },
  // An encounter step has no button until the game reports back.
  showsPrimary: (snapshot: Snapshot) =>
    currentStep(snapshot.context)?.type !== "encounter" ||
    questSelectors.isRevealed(snapshot),
  primaryLabel: (snapshot: Snapshot) => {
    const step = currentStep(snapshot.context);
    if (step?.type === "mystery" && !questSelectors.isRevealed(snapshot))
      return "Lock choice";
    return questSelectors.isLastStep(snapshot) ? "Finish quest" : "Continue";
  },
  primaryDisabled: (snapshot: Snapshot) => {
    const step = currentStep(snapshot.context);
    if (!step) return true;
    if (
      step.type === "mystery" &&
      questSelectors.isRevealed(snapshot) &&
      questSelectors.selectedCard(snapshot)
    )
      return false;
    if (
      step.type === "choice" ||
      step.type === "mystery" ||
      step.type === "encounter"
    )
      return !snapshot.context.answer;
    if (step.type === "riddle")
      return snapshot.context.answer.trim().toLowerCase() !== step.answer;
    return false;
  },
};
