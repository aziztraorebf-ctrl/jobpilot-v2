"use client"

import * as React from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { TokenUsageDisplay } from "./token-usage-display"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  tokens_used?: number
  created_at?: string
}

interface ChatInterfaceProps {
  title?: string
  placeholder?: string
  tokenLimit?: number
  className?: string
}

export function ChatInterface({
  title = "Career Exploration Chat",
  placeholder = "Ask me about your career options, skill gaps, or job search strategy...",
  tokenLimit,
  className,
}: ChatInterfaceProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [totalTokens, setTotalTokens] = React.useState(0)

  const handleSendMessage = async (userMessage: string) => {
    setIsLoading(true)

    // Optimistically add user message to UI
    const userMessageObj: Message = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessageObj])

    try {
      const response = await fetch("/api/ai/career-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId ?? undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to send message: ${response.status}`
        )
      }

      const data = await response.json()

      // Update conversation ID if this is the first message
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }

      // Add assistant response to messages
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
        tokens_used: data.tokensUsed,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Update total token count
      setTotalTokens((prev) => prev + (data.tokensUsed || 0))
    } catch (err) {
      console.error("[ChatInterface] Failed to send message:", err)
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to send message. Please try again."
      toast.error(errorMessage)

      // Remove optimistic user message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessageObj.id))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <TokenUsageDisplay
          tokensUsed={totalTokens}
          tokenLimit={tokenLimit}
          size="sm"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          className="h-[500px] rounded-lg border bg-muted/30"
        />

        <ChatInput
          onSubmit={handleSendMessage}
          disabled={isLoading}
          placeholder={placeholder}
        />
      </CardContent>
    </Card>
  )
}
