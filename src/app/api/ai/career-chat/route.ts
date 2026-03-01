import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getPrimaryResume } from "@/lib/supabase/queries/resumes";
import { getProfile } from "@/lib/supabase/queries/profiles";
import {
  sendCareerChatMessage,
  type CVContext,
  type ConversationMessage,
} from "@/lib/services/career-chat-service";
import { getSupabase } from "@/lib/supabase/client";
import { apiError } from "@/lib/api/error-response";
import {
  enforceAiRateLimit,
  parseJsonBody,
} from "@/lib/api/ai-route-helpers";
import type { ParsedResume } from "@/lib/schemas/ai-responses";

const CareerChatBody = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000),
  conversationId: z.string().uuid().optional(),
  language: z.enum(["fr", "en"]).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimited = enforceAiRateLimit(user.id);
    if (rateLimited) return rateLimited;

    const { data: raw, error: parseError } = await parseJsonBody(request);
    if (parseError) return parseError;

    const body = CareerChatBody.parse(raw);

    // Get user profile for language preference
    const profile = await getProfile(user.id);

    // Get user's primary resume for CV context
    const resume = await getPrimaryResume(user.id);
    if (!resume) {
      return NextResponse.json(
        { error: "No resume found. Please upload a resume first." },
        { status: 404 }
      );
    }
    if (!resume.parsed_data || typeof resume.parsed_data !== "object") {
      return NextResponse.json(
        {
          error:
            "Resume not yet analyzed. Call /api/ai/analyze-cv first.",
        },
        { status: 400 }
      );
    }

    const parsedResume = resume.parsed_data as ParsedResume;
    const cvContext: CVContext = {
      summary: parsedResume.summary,
      skills: parsedResume.skills,
      experience: parsedResume.experience,
      education: parsedResume.education,
    };

    // Determine language (from body, user preference, or default to 'fr')
    const language =
      body.language ?? (profile.preferred_language as "fr" | "en") ?? "fr";

    const supabase = getSupabase();
    let conversationId = body.conversationId;
    let conversationHistory: ConversationMessage[] = [];

    // Load or create conversation
    // NOTE: Using 'any' cast because career_conversations/career_messages tables
    // are not yet in generated types (migration 005 needs type regeneration)
    if (conversationId) {
      // Verify conversation belongs to user
      const { data: conversation, error: convError } = await (supabase as any)
        .from("career_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (convError || !conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Load conversation history
      const { data: messages, error: msgError } = await (supabase as any)
        .from("career_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (msgError) {
        throw new Error(`Failed to load conversation history: ${msgError.message}`);
      }

      conversationHistory = (messages ?? []).map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
    } else {
      // Create new conversation
      const { data: newConv, error: createError } = await (supabase as any)
        .from("career_conversations")
        .insert({
          user_id: user.id,
          title: body.message.substring(0, 100), // Use first 100 chars as title
        })
        .select("id")
        .single();

      if (createError || !newConv) {
        throw new Error(`Failed to create conversation: ${createError?.message}`);
      }

      conversationId = newConv.id;
    }

    // Generate AI response
    const result = await sendCareerChatMessage({
      userMessage: body.message,
      cvContext,
      conversationHistory,
      language,
    });

    // Save user message
    const { error: userMsgError } = await (supabase as any)
      .from("career_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: body.message,
        tokens_used: 0,
      });

    if (userMsgError) {
      console.error("[API] Failed to save user message:", userMsgError);
    }

    // Save assistant response
    const { error: aiMsgError } = await (supabase as any)
      .from("career_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: result.response.message,
        tokens_used: result.tokensUsed,
      });

    if (aiMsgError) {
      console.error("[API] Failed to save assistant message:", aiMsgError);
    }

    // Update conversation updated_at timestamp
    await (supabase as any)
      .from("career_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({
      conversationId,
      message: result.response.message,
      tokensUsed: result.tokensUsed,
      careerSuggestions: result.response.career_suggestions,
      skillRecommendations: result.response.skill_recommendations,
      followUpPrompts: result.response.follow_up_prompts,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/career-chat");
  }
}
