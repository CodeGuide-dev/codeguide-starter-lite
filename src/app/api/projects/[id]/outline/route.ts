import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { withRateLimit } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/security";
import { z } from "zod";

const updateOutlineSchema = z.object({
  outline_data: z.record(z.any()), // Flexible outline structure
  changes_summary: z.string().optional(),
});

interface RouteContext {
  params: {
    id: string;
  };
}

async function getOutlineHandler(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    const { data: project, error } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        outline_data,
        updated_at,
        template:templates(name, category, sections)
      `)
      .eq("id", id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this project
    const { data: accessCheck } = await supabase
      .from("projects")
      .select("owner_id, collaborators")
      .eq("id", id)
      .single();

    const hasAccess = accessCheck?.owner_id === userId || 
                     accessCheck?.collaborators.includes(userId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ 
      project: {
        id: project.id,
        title: project.title,
        outline_data: project.outline_data,
        updated_at: project.updated_at,
        template: project.template,
      }
    });
  } catch (error) {
    console.error("Error in get outline:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function updateOutlineHandler(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = updateOutlineSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { outline_data, changes_summary } = validation.data;

    const supabase = await createSupabaseServerClient();

    // Check if project exists and user has access
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("owner_id, collaborators")
      .eq("id", id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const hasAccess = project.owner_id === userId || 
                     project.collaborators.includes(userId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Update the project outline
    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({ 
        outline_data,
        status: "in_progress"
      })
      .eq("id", id)
      .select(`
        id,
        title,
        outline_data,
        updated_at,
        template:templates(name, category)
      `)
      .single();

    if (updateError) {
      console.error("Error updating project outline:", updateError);
      return NextResponse.json(
        { error: "Failed to update outline" },
        { status: 500 }
      );
    }

    // Create a new version
    const { data: versionData } = await supabase
      .from("project_versions")
      .select("version_number")
      .eq("project_id", id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = versionData && versionData.length > 0 
      ? versionData[0].version_number + 1 
      : 1;

    await supabase
      .from("project_versions")
      .insert({
        project_id: id,
        version_number: nextVersion,
        outline_data,
        changes_summary: changes_summary || "Manual outline update",
        created_by: userId,
      });

    return NextResponse.json({ 
      project: updatedProject,
      message: "Outline updated successfully" 
    });
  } catch (error) {
    console.error("Error in update outline:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const GET = withRateLimit(getOutlineHandler);
export const PUT = withRateLimit(updateOutlineHandler);