import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createId, readStored, writeStored } from "./storage";
import { streamSimulatedReply, titleFromPrompt } from "./simulated-ai";
import { useI18n } from "./i18n";
import { supabase } from "./supabase";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type ChatValue = {
  hydrated: boolean;
  conversations: Conversation[];
  streamingId: string | null;
  getConversation: (id: string) => Conversation | undefined;
  createConversation: () => Conversation;
  sendMessage: (conversationId: string, text: string, isFunny: boolean) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;
};

const ChatContext = createContext<ChatValue | null>(null);
const KEY = "conversations";

export function ChatProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;

    const loadForUser = async (nextUserId: string | null) => {
      if (!active) return;
      setUserId(nextUserId);
      setConversations(
        nextUserId ? readStored<Conversation[]>(`${KEY}:${nextUserId}`, []) : [],
      );
      setHydrated(true);
    };

    void supabase.auth.getUser().then(({ data }) => loadForUser(data.user?.id || null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadForUser(session?.user.id || null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const persist = useCallback((next: Conversation[]) => {
    if (userId) writeStored(`${KEY}:${userId}`, next);
    return next;
  }, [userId]);

  const createConversation = useCallback((): Conversation => {
    const conversation: Conversation = {
      id: createId("chat"),
      title: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => persist([conversation, ...prev]));
    return conversation;
  }, [persist]);

  const updateConversation = useCallback(
    (id: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((prev) =>
        persist(prev.map((c) => (c.id === id ? updater(c) : c))),
      );
    },
    [persist],
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string, isFunny: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      cancelRef.current?.();

      const userMessage: ChatMessage = {
        id: createId("msg"),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantMessage: ChatMessage = {
        id: createId("msg"),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      updateConversation(conversationId, (c) => ({
        ...c,
        title: c.title || titleFromPrompt(trimmed),
        updatedAt: Date.now(),
        messages: [...c.messages, userMessage, assistantMessage],
      }));

      setStreamingId(conversationId);

      const write = (content: string, done: boolean) => {
        updateConversation(conversationId, (c) => ({
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === assistantMessage.id ? { ...m, content } : m,
          ),
        }));
        if (done) {
          setStreamingId(null);
          cancelRef.current = null;
        }
      };

      cancelRef.current = streamSimulatedReply(
        trimmed,
        lang,
        isFunny,
        (partial) => write(partial, false),
        (full) => write(full, true),
      );
    },
    [lang, updateConversation],
  );

  useEffect(() => () => cancelRef.current?.(), []);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      updateConversation(id, (c) => ({ ...c, title: clean }));
    },
    [updateConversation],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => persist(prev.filter((c) => c.id !== id)));
    },
    [persist],
  );

  const clearAll = useCallback(() => {
    cancelRef.current?.();
    setStreamingId(null);
    setConversations(persist([]));
  }, [persist]);

  const value = useMemo<ChatValue>(
    () => ({
      hydrated,
      conversations,
      streamingId,
      getConversation: (id) => conversations.find((c) => c.id === id),
      createConversation,
      sendMessage,
      renameConversation,
      deleteConversation,
      clearAll,
    }),
    [
      hydrated,
      conversations,
      streamingId,
      createConversation,
      sendMessage,
      renameConversation,
      deleteConversation,
      clearAll,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore(): ChatValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used inside ChatProvider");
  return ctx;
}
