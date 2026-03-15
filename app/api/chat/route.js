export async function POST(request) {
  const { messages } = await request.json();
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  if (!GROQ_API_KEY) {
    return Response.json(
      { error: "API key not configured. Add GROQ_API_KEY in Vercel environment variables." },
      { status: 500 }
    );
  }

  const systemPrompt = `You are FurShop AI, an expert pet product advisor and shopping assistant. Your purpose is to help users choose the best products for their pets quickly, safely, and confidently. You are NOT a generic chatbot — you specialize in pet needs, pet safety, and product recommendations.

Follow these principles:
- PET-FIRST THINKING: Consider the pet's species, breed, age, weight, and health conditions. If missing, ask once — but still suggest products based on what you know.
- PROBLEM-BASED ADVICE: Translate user problems (e.g. "my dog destroys toys") into product solutions.
- SAFETY FIRST: Never recommend products dangerous for the described pet. Warn about choking hazards, toxic ingredients, or wrong sizing.
- DECISION HELP: When useful, label products: "Best durability", "Best value", "Best for puppies", etc.
- EDUCATIONAL TIPS: Add one short, useful pet care tip per response when relevant.
- TONE: Friendly, confident, concise. No long essays.
- FOLLOW-UP: End with one helpful question to refine recommendations.

You ALWAYS respond in valid JSON with this exact structure — no exceptions:

{
  "intro": "1-2 sentence friendly intro",
  "products": [
    {
      "name": "Exact product name",
      "brand": "Brand name",
      "price": "€XX",
      "description": "Why it fits this pet, key benefit, and price category (budget/mid-range/premium).",
      "pet_type": "dog"
    }
  ],
  "tip": "One short pet care tip or follow-up question"
}

STRICT RULES:
- Always include 3-5 products — never return an empty products array
- pet_type must be exactly "dog" or "cat" (lowercase)
- Use REAL product names and brands that actually exist and can be purchased online
- Do NOT invent fictional products — only recommend products you know are real
- If the user mentions any pet at all, recommend products immediately — never return empty products
- Respond ONLY with the JSON object — no markdown, no code fences, nothing outside the JSON`;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.role === "assistant"
        ? msg.content.replace(/ITEM_START[\s\S]*?ITEM_END/g, "[products shown]").replace(/\n{3,}/g, "\n\n").trim()
        : msg.content,
    })),
  ];

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      console.error("Groq API error:", JSON.stringify(groqData.error));
      return Response.json({ error: groqData.error.message }, { status: 500 });
    }

    const raw = groqData.choices?.[0]?.message?.content || "{}";
    let intro = "";
    let tip = "";
    let products = [];

    try {
      const parsed = JSON.parse(raw);
      intro = parsed.intro || "";
      tip = parsed.tip || "";
      products = parsed.products || [];
    } catch (e) {
      // If JSON parsing fails, return raw text
      return Response.json({ text: raw });
    }

    // ─── Enrich each product with real shopping links and images ───
    const enrichedProducts = await Promise.all(
      products.map(async (p) => {
        const name = p.name || "";
        const brand = p.brand || "";
        const petType = (p.pet_type || "dog").toLowerCase();
        const price = p.price || "";
        const description = p.description || "";

        // Build a clean search query (avoid doubling the brand if it's already in the name)
        const nameIncludesBrand = name.toLowerCase().includes(brand.toLowerCase());
        const searchName = nameIncludesBrand ? name : `${brand} ${name}`;
        const query = `${searchName} ${petType === "cat" ? "cat" : "dog"} pet shop`;

        let url = "";
        let imageUrl = "";
        let realPrice = price;

        if (SERPER_API_KEY) {
          try {
            const serperRes = await fetch("https://google.serper.dev/shopping", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": SERPER_API_KEY,
              },
              body: JSON.stringify({
                q: query,
                num: 5,
                gl: "de",
                hl: "de",
              }),
            });

            const serperData = await serperRes.json();
            const results = serperData.shopping || [];

            console.log(`Serper query: "${query}" → ${results.length} results`);

            // Pick the best result: prefer ones with both a link and an image
            const bestResult = results.find(r => r.link && r.imageUrl)
              || results.find(r => r.link)
              || results[0];

            if (bestResult) {
              url = bestResult.link || "";
              imageUrl = bestResult.imageUrl || "";
              // Use the real price from the shop if available
              if (bestResult.price) {
                realPrice = bestResult.price;
              }
              console.log(`  → URL: ${url}`);
              console.log(`  → Image: ${imageUrl}`);
              console.log(`  → Price: ${realPrice}`);
            }
          } catch (e) {
            console.error(`Serper error for "${query}":`, e.message);
          }
        }

        // Fallback: Google search link if Serper didn't return a direct link
        if (!url) {
          url = `https://www.google.com/search?q=${encodeURIComponent(searchName + " buy")}`;
        }

        return { name, brand, price: realPrice, description, petType, url, imageUrl };
      })
    );

    // ─── Build the final response text ───
    const blocks = enrichedProducts
      .map(
        (p) =>
          `ITEM_START\nNAME: ${p.name}\nBRAND: ${p.brand}\nPRICE: ${p.price}\nDESCRIPTION: ${p.description}\nPET_TYPE: ${p.petType}\nURL: ${p.url}\nIMAGE: ${p.imageUrl}\nITEM_END`
      )
      .join("\n\n");

    const text = [intro, blocks, tip].filter(Boolean).join("\n\n");

    return Response.json({ text });
  } catch (error) {
    console.error("Fetch error:", error.message);
    return Response.json({ error: "Connection issue — please try again." }, { status: 500 });
  }
}
