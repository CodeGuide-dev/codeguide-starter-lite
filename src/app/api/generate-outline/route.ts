import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withRateLimit } from "@/lib/rate-limit";
import { AIOutlineGenerator, AIRateLimit } from "@/lib/ai-service";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isValidUUID } from "@/lib/security";
import { z } from "zod";

const generateOutlineSchema = z.object({
  prompt: z.string().min(10).max(2000),
  template_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  options: z.object({
    model: z.enum(["gpt-4", "gpt-4-turbo", "claude-3-5-sonnet"]).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(100).max(8000).optional(),
  }).optional(),
});

async function generateOutlineHandler(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limiting for AI requests
    const canMakeRequest = await AIRateLimit.checkRateLimit(userId);
    if (!canMakeRequest) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded", 
          message: "Too many AI requests. Please wait before making another request." 
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = generateOutlineSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { prompt, template_id, project_id, options } = validation.data;

    const supabase = await createSupabaseServerClient();
    let template = null;

    // Get template if provided
    if (template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from("templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (templateError || !templateData) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      // Check if user can access this template
      if (!templateData.is_public && templateData.created_by !== userId) {
        return NextResponse.json(
          { error: "Access denied to template" },
          { status: 403 }
        );
      }

      template = templateData;
    }

    // Verify project access if project_id is provided
    if (project_id) {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("owner_id, collaborators")
        .eq("id", project_id)
        .single();

      if (projectError || !projectData) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Check if user has access to the project
      const hasAccess = projectData.owner_id === userId || 
                       projectData.collaborators.includes(userId);
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Access denied to project" },
          { status: 403 }
        );
      }
    }

    try {
      // Generate the outline using AI
      const outline = await AIOutlineGenerator.generateOutline(
        prompt,
        template || undefined,
        {
          ...options,
          userId,
        }
      );

      // If project_id is provided, update the project with the generated outline
      if (project_id) {
        const { error: updateError } = await supabase
          .from("projects")
          .update({ 
            outline_data: outline,
            status: "in_progress"
          })
          .eq("id", project_id);

        if (updateError) {
          console.error("Error updating project with outline:", updateError);
          // Don't fail the request if we can't update the project
        } else {
          // Create a new version for the project
          const { data: versionData } = await supabase
            .from("project_versions")
            .select("version_number")
            .eq("project_id", project_id)
            .order("version_number", { ascending: false })
            .limit(1);

          const nextVersion = versionData && versionData.length > 0 
            ? versionData[0].version_number + 1 
            : 1;

          await supabase
            .from("project_versions")
            .insert({
              project_id,
              version_number: nextVersion,
              outline_data: outline,
              changes_summary: "AI-generated outline",
              created_by: userId,
            });
        }
      }

      return NextResponse.json({ 
        outline,
        message: "Outline generated successfully",
        template_used: template?.name || null
      });

    } catch (aiError) {
      console.error("AI generation error:", aiError);
      
      // Return a more user-friendly error message
      const errorMessage = aiError instanceof Error 
        ? aiError.message 
        : "Failed to generate outline";
      
      return NextResponse.json(
        { 
          error: "AI service error", 
          message: errorMessage,
          fallback_available: true
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error("Error in generate outline:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getGenerationHistoryHandler(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = await createSupabaseServerClient();
    
    const { data: history, error } = await supabase
      .from("ai_generation_logs")
      .select(`
        id,
        prompt,
        model,
        success,
        response_time_ms,
        created_at,
        project:projects(id, title)
      `)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching generation history:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error in get generation history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const POST = withRateLimit(generateOutlineHandler);
export const GET = withRateLimit(getGenerationHistoryHandler);