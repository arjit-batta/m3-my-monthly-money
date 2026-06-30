import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ParsedEntry {
  amount: number;
  category_id: string | null;
  sub_category_id: string | null;
  payment_mode_id: string | null;
  note: string;
  matched_by: "mapping" | "ai";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) return json({ error: "Transcript is required" }, 400);
    if (transcript.length > 2000) return json({ error: "Transcript too long" }, 400);

    // Load user data
    const [catsRes, subsRes, pmsRes, mapsRes] = await Promise.all([
      supabase.from("categories").select("id, name").eq("user_id", userId),
      supabase.from("sub_categories").select("id, name, category_id").eq("user_id", userId),
      supabase.from("payment_modes").select("id, name").eq("user_id", userId),
      supabase.from("voice_mappings").select("keyword, category_id, sub_category_id").eq("user_id", userId),
    ]);

    if (catsRes.error || subsRes.error || pmsRes.error || mapsRes.error) {
      return json({ error: "Failed to load your data. Please try again." }, 500);
    }

    const categories = catsRes.data ?? [];
    const subCategories = subsRes.data ?? [];
    const paymentModes = pmsRes.data ?? [];
    const mappings = mapsRes.data ?? [];

    if (categories.length === 0) {
      return json({ error: "No categories found. Add some categories first." }, 400);
    }

    // Step 1: ask LLM to segment the transcript into entries (amount + phrase + payment hint)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI service not configured." }, 500);
    }

    const systemPrompt =
      "You parse short spoken expense transcripts into structured entries. " +
      "Return ONLY valid JSON matching the schema. Amounts are numbers (no currency). " +
      "Split the transcript into one entry per distinct expense. " +
      "For each entry, pick the best category and sub-category from the provided lists by name " +
      "(use null if no good match). Pick a payment_mode by name only if the transcript clearly mentions it, else null. " +
      "Keep the note short (a few words describing the item).";

    const userPayload = {
      transcript,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      sub_categories: subCategories.map((s) => ({
        id: s.id,
        name: s.name,
        category_id: s.category_id,
      })),
      payment_modes: paymentModes.map((p) => ({ id: p.id, name: p.name })),
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_entries",
              description: "Return the parsed expense entries.",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        amount: { type: "number" },
                        category_id: { type: ["string", "null"] },
                        sub_category_id: { type: ["string", "null"] },
                        payment_mode_id: { type: ["string", "null"] },
                        note: { type: "string" },
                      },
                      required: ["amount", "note"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["entries"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_entries" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text().catch(() => "");
      if (aiResp.status === 429) {
        return json({ error: "AI is rate-limited. Please try again in a moment." }, 429);
      }
      if (aiResp.status === 402) {
        return json({ error: "AI credits exhausted. Please add credits to continue." }, 402);
      }
      console.error("AI gateway error", aiResp.status, txt);
      let upstream = txt;
      try {
        const parsedTxt = JSON.parse(txt);
        upstream = parsedTxt?.message || parsedTxt?.error?.message || parsedTxt?.error || txt;
      } catch {
        // not JSON, use raw text
      }
      return json(
        {
          error: `AI gateway error ${aiResp.status}: ${upstream || "unknown error"}`,
          upstream_status: aiResp.status,
        },
        502,
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    let parsed: { entries: Array<Record<string, unknown>> } = { entries: [] };
    try {
      parsed = argsStr
        ? JSON.parse(argsStr)
        : JSON.parse(aiJson?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return json({ error: "Could not understand the transcript. Please try again." }, 422);
    }

    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    if (rawEntries.length === 0) {
      return json({ error: "No expenses detected in the transcript." }, 422);
    }

    const catIds = new Set(categories.map((c) => c.id));
    const subById = new Map(subCategories.map((s) => [s.id, s]));
    const pmIds = new Set(paymentModes.map((p) => p.id));

    // Apply voice mappings as overrides on the note/keyword text
    const lowerTranscript = transcript.toLowerCase();
    const sortedMappings = [...mappings].sort(
      (a, b) => (b.keyword?.length ?? 0) - (a.keyword?.length ?? 0),
    );

    const entries: ParsedEntry[] = rawEntries
      .map((e): ParsedEntry | null => {
        const amount = Number(e.amount);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        const note = typeof e.note === "string" ? e.note.trim() : "";

        let categoryId = typeof e.category_id === "string" && catIds.has(e.category_id)
          ? e.category_id
          : null;
        let subCategoryId =
          typeof e.sub_category_id === "string" && subById.has(e.sub_category_id)
            ? e.sub_category_id
            : null;
        const paymentModeId =
          typeof e.payment_mode_id === "string" && pmIds.has(e.payment_mode_id)
            ? e.payment_mode_id
            : null;

        // Ensure sub_category belongs to selected category
        if (subCategoryId) {
          const sub = subById.get(subCategoryId)!;
          if (!categoryId) categoryId = sub.category_id;
          if (categoryId !== sub.category_id) subCategoryId = null;
        }

        let matchedBy: "mapping" | "ai" = "ai";
        const haystack = (note + " " + lowerTranscript).toLowerCase();
        for (const m of sortedMappings) {
          if (!m.keyword) continue;
          if (haystack.includes(m.keyword.toLowerCase())) {
            if (catIds.has(m.category_id)) {
              categoryId = m.category_id;
              if (m.sub_category_id && subById.has(m.sub_category_id)) {
                const sub = subById.get(m.sub_category_id)!;
                if (sub.category_id === m.category_id) {
                  subCategoryId = m.sub_category_id;
                } else {
                  subCategoryId = null;
                }
              } else {
                subCategoryId = null;
              }
              matchedBy = "mapping";
              break;
            }
          }
        }

        return {
          amount,
          category_id: categoryId,
          sub_category_id: subCategoryId,
          payment_mode_id: paymentModeId,
          note,
          matched_by: matchedBy,
        };
      })
      .filter((e): e is ParsedEntry => e !== null);

    if (entries.length === 0) {
      return json({ error: "Could not extract any valid expense from the transcript." }, 422);
    }

    return json({ entries });
  } catch (err) {
    console.error("parse-expense error", err);
    return json({ error: "Something went wrong while parsing the transcript." }, 500);
  }
});