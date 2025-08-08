import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  template_id: z.string().uuid().optional(),
});

async function getProjectsHandler(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    
    const { data: projects, error } = await supabase
      .from("projects")
      .select(`
        *,
        template:templates(name, category)
      `)
      .or(`owner_id.eq.${userId},collaborators.cs.{${userId}}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error in get projects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function createProjectHandler(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = createProjectSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { title, description, template_id } = validation.data;

    const supabase = await createSupabaseServerClient();

    // If template_id is provided, verify it exists
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from("templates")
        .select("id")
        .eq("id", template_id)
        .single();

      if (templateError || !template) {
        return NextResponse.json(
          { error: "Invalid template ID" },
          { status: 400 }
        );
      }
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        title,
        description,
        template_id,
        owner_id: userId,
        outline_data: {},
      })
      .select(`
        *,
        template:templates(name, category)
      `)
      .single();

    if (error) {
      console.error("Error creating project:", error);
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 }
      );
    }

    // Create initial version
    await supabase
      .from("project_versions")
      .insert({
        project_id: project.id,
        version_number: 1,
        outline_data: {},
        changes_summary: "Initial version",
        created_by: userId,
      });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error in create project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting to both handlers
export const GET = withRateLimit(getProjectsHandler);
export const POST = withRateLimit(createProjectHandler);