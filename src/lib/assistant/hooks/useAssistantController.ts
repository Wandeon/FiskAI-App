import { useReducer, useCallback, useRef } from "react"
import { nanoid } from "nanoid"
import type {
  Surface,
  AssistantControllerState,
  AssistantResponse,
  AssistantError,
  HistoryItem,
} from "../types"

interface UseAssistantControllerProps {
  surface: Surface
}

type Action =
  | { type: "SUBMIT"; query: string; requestId: string }
  | { type: "STREAM_START" }
  | { type: "STREAM_UPDATE"; data: Partial<AssistantResponse> }
  | { type: "COMPLETE"; response: AssistantResponse }
  | { type: "ERROR"; error: AssistantError }
  | { type: "CANCEL" }
  | { type: "RESTORE_HISTORY"; index: number }
  | { type: "CLEAR_HISTORY" }
  | { type: "RETRY" }

const initialState: AssistantControllerState = {
  status: "IDLE",
  activeRequestId: null,
  activeQuery: null,
  activeAnswer: null,
  history: [],
  error: null,
  retryCount: 0,
  streamProgress: {
    headline: false,
    directAnswer: false,
    citations: false,
    clientContext: false,
  },
}

function reducer(state: AssistantControllerState, action: Action): AssistantControllerState {
  switch (action.type) {
    case "SUBMIT":
      return {
        ...state,
        status: "LOADING",
        activeRequestId: action.requestId,
        activeQuery: action.query,
        activeAnswer: null,
        error: null,
        streamProgress: {
          headline: false,
          directAnswer: false,
          citations: false,
          clientContext: false,
        },
      }

    case "STREAM_START":
      return {
        ...state,
        status: "STREAMING",
      }

    case "STREAM_UPDATE": {
      const currentAnswer = state.activeAnswer || ({} as Partial<AssistantResponse>)
      const newAnswer = { ...currentAnswer, ...action.data } as AssistantResponse

      return {
        ...state,
        activeAnswer: newAnswer,
        streamProgress: {
          headline: !!newAnswer.headline || state.streamProgress.headline,
          directAnswer: !!newAnswer.directAnswer || state.streamProgress.directAnswer,
          citations: !!newAnswer.citations || state.streamProgress.citations,
          clientContext: !!newAnswer.clientContext || state.streamProgress.clientContext,
        },
      }
    }

    default:
      return state
  }
}

export function useAssistantController({ surface }: UseAssistantControllerProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const abortControllerRef = useRef<AbortController | null>(null)

  const submit = useCallback(async (query: string) => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const requestId = nanoid()
    abortControllerRef.current = new AbortController()

    dispatch({ type: "SUBMIT", query, requestId })

    // API call will be added in Task 10
  }, [])

  return {
    state,
    surface,
    submit,
    dispatch,
  }
}
