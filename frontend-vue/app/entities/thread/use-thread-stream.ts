import { storeToRefs } from "pinia";

import {
  useThreadStreamStore,
  type JoinThreadStreamOptions,
  type StartThreadMessageOptions,
  type StopThreadStreamOptions,
} from "./stream-store";

export function useThreadStream() {
  const store = useThreadStreamStore();
  const state = storeToRefs(store);

  onUnmounted(() => {
    void store.stop({ drain: false });
  });

  return {
    ...state,
    joinRun: (options: JoinThreadStreamOptions) => store.joinRun(options),
    reset: store.reset,
    sendMessage: (options: StartThreadMessageOptions) => store.sendMessage(options),
    setHistoryMessages: store.setHistoryMessages,
    stop: (options?: StopThreadStreamOptions) => store.stop(options),
  };
}
