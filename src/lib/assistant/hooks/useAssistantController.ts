import { useReducer, useCallback, useRef } from "react"
import { nanoid } from "nanoid"
import type {
  Surface,
  AssistantControllerState,
  AssistantResponse,
  AssistantError,
  HistoryItem,
  ErrorType,
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

    case "COMPLETE": {
      const historyItem: HistoryItem = {
        id: nanoid(),
        query: state.activeQuery || "",
        answer: action.response,
        timestamp: new Date().toISOString(),
      }

      // Check if APP surface with incomplete client context.
      // Only transition to PARTIAL_COMPLETE if clientContext was explicitly provided
      // but is not yet complete. Responses without clientContext always go to COMPLETE.
      const isPartialComplete =
        action.response.surface === "APP" &&
        !!action.response.clientContext &&
        action.response.clientContext.completeness.status !== "COMPLETE"

      return {
        ...state,
        status: isPartialComplete ? "PARTIAL_COMPLETE" : "COMPLETE",
        activeAnswer: action.response,
        history: [...state.history, historyItem],
        retryCount: 0,
      }
    }

    case "ERROR":
      return {
        ...state,
        status: "ERROR",
        error: action.error,
      }

    case "RESTORE_HISTORY": {
      const item = state.history[action.index]
      if (!item) return state

      return {
        ...state,
        status: "COMPLETE",
        activeQuery: item.query,
        activeAnswer: item.answer,
      }
    }

    case "CLEAR_HISTORY":
      return {
        ...state,
        history: [],
      }

    case "RETRY":
      return {
        ...state,
        status: "LOADING",
        error: null,
        retryCount: state.retryCount + 1,
      }

    default:
      return state
  }
}

export function useAssistantController({ surface }: UseAssistantControllerProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const abortControllerRef = useRef<AbortController | null>(null)

  const submit = useCallback(
    async (query: string) => {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const requestId = nanoid()
      abortControllerRef.current = new AbortController()

      dispatch({ type: "SUBMIT", query, requestId })

      try {
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, surface }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const status = response.status
          let errorType: ErrorType = "SERVER_ERROR"

          if (status >= 400 && status < 500) errorType = "CLIENT_ERROR"
          if (status === 429) errorType = "RATE_LIMITED"

          throw { type: errorType, message: `HTTP ${status}`, httpStatus: status }
        }

        const data = (await response.json()) as AssistantResponse
        dispatch({ type: "COMPLETE", response: data })
      } catch (error: any) {
        if (error.name === "AbortError") {
          // Request was cancelled, don't dispatch error
          return
        }

        const assistantError: AssistantError = error.type
          ? error
          : {
              type: "NETWORK_FAILURE" as ErrorType,
              message: error.message || "Network request failed",
            }

        dispatch({ type: "ERROR", error: assistantError })
      }
    },
    [surface]
  )

  return {
    state,
    surface,
    submit,
    dispatch,
  }
}
