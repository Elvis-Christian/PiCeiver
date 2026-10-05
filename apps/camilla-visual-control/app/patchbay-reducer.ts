import { CamillaConfig } from "./camilla-model";

export type PatchbayHistory = {
  confirmed: CamillaConfig;
  present: CamillaConfig;
  past: CamillaConfig[];
  future: CamillaConfig[];
};

export type PatchbayAction =
  | { type: "reset"; config: CamillaConfig }
  | { type: "edit"; config: CamillaConfig }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "discard" };

export function createPatchbayHistory(config: CamillaConfig): PatchbayHistory {
  const confirmed = structuredClone(config);
  return { confirmed, present: confirmed, past: [], future: [] };
}

export function patchbayReducer(state: PatchbayHistory, action: PatchbayAction): PatchbayHistory {
  if (action.type === "reset") return createPatchbayHistory(action.config);
  if (action.type === "discard") return { ...state, present: structuredClone(state.confirmed), past: [], future: [] };
  if (action.type === "edit") return { ...state, past: [...state.past, state.present], present: action.config, future: [] };
  if (action.type === "undo") {
    const previous = state.past[state.past.length - 1];
    if (!previous) return state;
    return { ...state, past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  const next = state.future[0];
  if (!next) return state;
  return { ...state, past: [...state.past, state.present], present: next, future: state.future.slice(1) };
}

export function patchbayIsDirty(state: PatchbayHistory) {
  return JSON.stringify(state.present) !== JSON.stringify(state.confirmed);
}
