import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { withRateLimit } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/security";
import { z } from "zod";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().min(1).max(50).optional(),
  sections: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string(),
      required: z.boolean(),
    })
  ).optional(),
  is_public: z.boolean().optional(),
});

interface RouteContext {
  params: {
    id: string;
  };
}

async function getTemplateHandler(req: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    const { data: template, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check if user can access this template
    const { userId } = await auth();
    if (!template.is_public && template.created_by !== userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error in get template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function updateTemplateHandler(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = updateTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check if template exists and user owns it
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("templates")
      .select("created_by")
      .eq("id", id)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (existingTemplate.created_by !== userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const { data: template, error } = await supabase
      .from("templates")
      .update(validation.data)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating template:", error);
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error in update template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function deleteTemplateHandler(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check if template exists and user owns it
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("templates")
      .select("created_by")
      .eq("id", id)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (existingTemplate.created_by !== userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting template:", error);
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error in delete template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting to all handlers
export const GET = withRateLimit(getTemplateHandler);
export const PUT = withRateLimit(updateTemplateHandler);
export const DELETE = withRateLimit(deleteTemplateHandler);