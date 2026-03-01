-- ============================================
-- JobPilot - Career Exploration Chat Tables
-- Adds support for AI-powered career conversations
-- ============================================

-- ============================================
-- Career Conversations
-- ============================================
CREATE TABLE public.career_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Career Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_career_conversations_user ON public.career_conversations(user_id, updated_at DESC);

-- ============================================
-- Career Messages
-- ============================================
CREATE TABLE public.career_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.career_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_career_messages_conversation ON public.career_messages(conversation_id, created_at ASC);
CREATE INDEX idx_career_messages_created ON public.career_messages(created_at DESC);
