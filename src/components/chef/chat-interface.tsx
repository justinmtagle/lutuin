"use client";

import { useState, useRef, useEffect } from "react";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";
import ChatRecipeCard, { type ChatRecipe } from "@/components/chef/chat-recipe-card";

type Message = { role: "user" | "assistant"; content: string };

const RECIPE_BLOCK_REGEX = /:::recipe\s*([\s\S]*?)\s*:::/g;

function parseMessageContent(
  content: string
): Array<
  { type: "text"; text: string } | { type: "recipe"; recipe: ChatRecipe }
> {
  const parts: Array<
    { type: "text"; text: string } | { type: "recipe"; recipe: ChatRecipe }
  > = [];
  let lastIndex = 0;

  const matches = content.matchAll(RECIPE_BLOCK_REGEX);
  for (const match of matches) {
    // Add text before this recipe block
    if (match.index !== undefined && match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", text });
    }

    // Try to parse the recipe JSON
    try {
      const recipe = JSON.parse(match[1]) as ChatRecipe;
      if (recipe.name && recipe.ingredients && recipe.steps) {
        parts.push({ type: "recipe", recipe });
      } else {
        parts.push({ type: "text", text: match[0] });
      }
    } catch {
      // If JSON is invalid (e.g. still streaming), show as text
      parts.push({ type: "text", text: match[0] });
    }

    lastIndex = (match.index ?? 0) + match[0].length;
  }

  // Add remaining text after last recipe block
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: "text", text });
  }

  // If no parts were created, return the whole content as text
  if (parts.length === 0 && content.trim()) {
    parts.push({ type: "text", text: content });
  }

  return parts;
}

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
              Tell me what you want to cook, or ask anything about Filipino
              cuisine
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-amber-500 text-white">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[85%]">
                <div className="space-y-2">
                  {parseMessageContent(msg.content).map((part, j) =>
                    part.type === "recipe" ? (
                      <ChatRecipeCard key={j} recipe={part.recipe} />
                    ) : (
                      <div
                        key={j}
                        className="px-4 py-3 rounded-2xl bg-stone-100 text-stone-800"
                      >
                        <p className="whitespace-pre-wrap">{part.text}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
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
            placeholder="I want to make chicken tinola..."
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
