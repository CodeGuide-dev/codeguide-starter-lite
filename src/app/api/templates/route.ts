import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().min(1).max(50),
  sections: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string(),
      required: z.boolean(),
    })
  ).min(1),
  is_public: z.boolean().default(false),
});

async function getTemplatesHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const includePrivate = searchParams.get("include_private") === "true";

    const supabase = await createSupabaseServerClient();
    const { userId } = await auth();
    
    let query = supabase
      .from("templates")
      .select("*")
      .order("name");

    if (includePrivate && userId) {
      // Get public templates AND user's private templates
      query = query.or(`is_public.eq.true,created_by.eq.${userId}`);
    } else {
      // Get only public templates
      query = query.eq("is_public", true);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error in get templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function createTemplateHandler(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = createTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, category, sections, is_public } = validation.data;

    const supabase = await createSupabaseServerClient();

    // Check if template with same name already exists for this user
    const { data: existingTemplate } = await supabase
      .from("templates")
      .select("id")
      .eq("name", name)
      .eq("created_by", userId)
      .single();

    if (existingTemplate) {
      return NextResponse.json(
        { error: "Template with this name already exists" },
        { status: 409 }
      );
    }

    const { data: template, error } = await supabase
      .from("templates")
      .insert({
        name,
        description,
        category,
        sections,
        is_public,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error in create template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const GET = withRateLimit(getTemplatesHandler);
export const POST = withRateLimit(createTemplateHandler);