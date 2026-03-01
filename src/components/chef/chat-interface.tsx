"use client";

import { useState, useRef, useEffect } from "react";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message for streaming
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    const response = await fetch("/api/chef/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      setMessages([
        ...newMessages,
        { role: "assistant", content: err.error || "Something went wrong." },
      ]);
      setStreaming(false);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let buffer = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const lines = buffer.split("\n");
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              accumulated = parsed.error;
              setMessages([
                ...newMessages,
                { role: "assistant", content: accumulated },
              ]);
              break;
            }
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages([
                ...newMessages,
                { role: "assistant", content: accumulated },
              ]);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }

    // Check for chat achievements
    try {
      const achieveRes = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "chat_message" }),
      });
      if (achieveRes.ok) {
        const achieveData = await achieveRes.json();
        if (achieveData.newAchievements?.length) {
          showAchievementToasts(achieveData.newAchievements);
        }
      }
    } catch {
      // Achievement check failure shouldn't block the flow
    }

    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-stone-400 mt-12">
            <p className="text-lg font-medium">Chef Luto is ready!</p>
            <p className="text-sm mt-1">
              Tell me what you&apos;re in the mood for
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-amber-500 text-white"
                  : "bg-stone-100 text-stone-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-stone-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Chef Luto..."
            disabled={streaming}
            className="flex-1 px-4 py-3 rounded-full border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-6 py-3 bg-amber-600 text-white rounded-full hover:bg-amber-700 disabled:opacity-50 font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
