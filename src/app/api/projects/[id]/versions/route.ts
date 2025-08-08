import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { withRateLimit } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/security";

interface RouteContext {
  params: {
    id: string;
  };
}

async function getVersionsHandler(req: NextRequest, context: RouteContext) {
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = await createSupabaseServerClient();

    // Check if user has access to this project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("owner_id, collaborators")
      .eq("id", id)
      .single();

    if (projectError || !project) {
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

    // Get project versions
    const { data: versions, error } = await supabase
      .from("project_versions")
      .select(`
        id,
        version_number,
        changes_summary,
        created_at,
        created_by,
        outline_data
      `)
      .eq("project_id", id)
      .order("version_number", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching versions:", error);
      return NextResponse.json(
        { error: "Failed to fetch versions" },
        { status: 500 }
      );
    }

    // Get total count
    const { count } = await supabase
      .from("project_versions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id);

    return NextResponse.json({ 
      versions,
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error("Error in get versions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function restoreVersionHandler(req: NextRequest, context: RouteContext) {
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
    const { version_number } = body;

    if (!version_number || typeof version_number !== "number") {
      return NextResponse.json(
        { error: "Valid version number is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check if user has access to this project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("owner_id, collaborators")
      .eq("id", id)
      .single();

    if (projectError || !project) {
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

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("outline_data")
      .eq("project_id", id)
      .eq("version_number", version_number)
      .single();

    if (versionError || !version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // Update the project with the restored outline
    const { error: updateError } = await supabase
      .from("projects")
      .update({ 
        outline_data: version.outline_data,
        status: "in_progress"
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error restoring version:", updateError);
      return NextResponse.json(
        { error: "Failed to restore version" },
        { status: 500 }
      );
    }

    // Create a new version entry for the restoration
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
        outline_data: version.outline_data,
        changes_summary: `Restored from version ${version_number}`,
        created_by: userId,
      });

    return NextResponse.json({ 
      message: `Successfully restored to version ${version_number}`,
      new_version: nextVersion
    });
  } catch (error) {
    console.error("Error in restore version:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const GET = withRateLimit(getVersionsHandler);
export const POST = withRateLimit(restoreVersionHandler);