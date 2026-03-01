"use client"

import * as React from "react"
import { Bot, User } from "lucide-react"

import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  tokens_used?: number
  created_at?: string
}

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  className?: string
}

export function MessageList({
  messages,
  isLoading = false,
  className,
}: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex flex-col gap-4 overflow-y-auto p-4",
        className
      )}
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
          <Bot className="size-12 opacity-20" />
          <p className="text-sm">Start a conversation to explore your career options</p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
            <div className="flex gap-1">
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.3s]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.15s]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="size-4" />
        ) : (
          <Bot className="size-4 text-primary" />
        )}
      </div>

      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1 rounded-2xl px-4 py-3",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted"
        )}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </div>
        {message.created_at && (
          <time
            className={cn(
              "text-[10px] opacity-60",
              isUser ? "text-right" : "text-left"
            )}
            dateTime={message.created_at}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    </div>
  )
}
