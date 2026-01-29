import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid categories - strict list
const VALID_CATEGORIES = [
  'Moradia',
  'Contas Fixas',
  'Alimentação',
  'Restaurante',
  'Transporte',
  'Saúde',
  'Seguros',
  'Assinaturas',
  'Lazer',
  'Educação',
  'Investimentos',
  'Outros'
] as const;

// Rule-based pre-categorization for common patterns (faster than AI for known cases)
function preCategorize(description: string): string | null {
  const lower = description.toLowerCase();
  
  // Transporte
  if (/\b(uber|99|cabify|shell|ipiranga|br\s?distribuidora|posto|gasolina|estacionamento|pedágio|sem parar|conectcar)\b/.test(lower)) {
    return 'Transporte';
  }
  
  // Restaurante
  if (/\b(ifood|rappi|zé\s?delivery|99\s?food|uber\s?eats|outback|mcdonalds|burger\s?king|starbucks|habibs|subway)\b/.test(lower)) {
    return 'Restaurante';
  }
  
  // Assinaturas
  if (/\b(netflix|spotify|amazon\s?prime|disney|hbo|apple\s?music|deezer|youtube\s?premium|globoplay|paramount|star\+)\b/.test(lower)) {
    return 'Assinaturas';
  }
  
  // Contas Fixas
  if (/\b(claro|vivo|oi|tim|net\b|sky|internet|telefone|celular|cpfl|enel|sabesp|copasa|cemig|light|eletropaulo)\b/.test(lower)) {
    return 'Contas Fixas';
  }
  
  // Alimentação (Supermercados)
  if (/\b(carrefour|extra|pão\s?de\s?açúcar|assaí|atacadão|sams\s?club|costco|supermercado|mercado|hortifruti|feira)\b/.test(lower)) {
    return 'Alimentação';
  }
  
  // Saúde
  if (/\b(drogasil|drogaraia|pague\s?menos|farmácia|hospital|clínica|médico|consulta|exame|laboratório|unimed|hapvida|amil)\b/.test(lower)) {
    return 'Saúde';
  }
  
  // Moradia
  if (/\b(aluguel|condomínio|iptu|energia|luz|água|gás)\b/.test(lower)) {
    return 'Moradia';
  }
  
  // Seguros
  if (/\b(porto\s?seguro|bradesco\s?seguros|sulamerica|seguro|apólice)\b/.test(lower)) {
    return 'Seguros';
  }
  
  // Educação
  if (/\b(escola|faculdade|universidade|curso|udemy|alura|mensalidade|matrícula|livro|livraria)\b/.test(lower)) {
    return 'Educação';
  }
  
  // Investimentos
  if (/\b(xp\s?investimentos|nuinvest|rico|btg|tesouro\s?direto|cdb|investimento|ações|fii)\b/.test(lower)) {
    return 'Investimentos';
  }
  
  // Lazer
  if (/\b(cinema|teatro|show|ingresso|parque|viagem|hotel|airbnb|booking|decolar)\b/.test(lower)) {
    return 'Lazer';
  }
  
  return null; // Unknown - will use AI
}

interface CategorizeRequest {
  descriptions: string[];
}

interface CategoryResult {
  description: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'rule' | 'ai';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { descriptions } = await req.json() as CategorizeRequest;

    if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "descriptions array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: CategoryResult[] = [];
    const needsAI: { index: number; description: string }[] = [];

    // Step 1: Apply rule-based categorization first
    for (let i = 0; i < descriptions.length; i++) {
      const description = descriptions[i];
      const ruleCategory = preCategorize(description);
      
      if (ruleCategory) {
        results[i] = {
          description,
          category: ruleCategory,
          confidence: 'high',
          source: 'rule'
        };
      } else {
        needsAI.push({ index: i, description });
      }
    }

    // Step 2: Use AI for unknown descriptions
    if (needsAI.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        // Fallback to 'Outros' if no AI available
        for (const item of needsAI) {
          results[item.index] = {
            description: item.description,
            category: 'Outros',
            confidence: 'low',
            source: 'rule'
          };
        }
      } else {
        const aiDescriptions = needsAI.map(n => n.description);
        
        const systemPrompt = `Você é um categorizador de transações financeiras brasileiro.
        
REGRAS:
1. Você DEVE retornar APENAS categorias desta lista EXATA: ${VALID_CATEGORIES.join(', ')}
2. Nunca invente categorias novas
3. Se não tiver certeza, use "Outros"
4. Responda APENAS com JSON válido, sem explicações

Para cada descrição de transação, determine a categoria mais apropriada.`;

        const userPrompt = `Categorize estas transações bancárias. Retorne um array JSON com objetos {description, category} para cada uma:

${aiDescriptions.map((d, i) => `${i + 1}. "${d}"`).join('\n')}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", // Fast and cheap for classification
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.1 // Low temperature for consistent categorization
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AI Gateway error:", response.status, errorText);
          
          // Handle rate limits
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Fallback for other errors
          for (const item of needsAI) {
            results[item.index] = {
              description: item.description,
              category: 'Outros',
              confidence: 'low',
              source: 'ai'
            };
          }
        } else {
          const aiResponse = await response.json();
          const content = aiResponse.choices?.[0]?.message?.content || '';
          
          try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1].trim();
            }
            
            const aiCategories = JSON.parse(jsonStr);
            
            for (let i = 0; i < needsAI.length; i++) {
              const item = needsAI[i];
              const aiResult = aiCategories[i] || aiCategories.find((r: any) => 
                r.description?.toLowerCase().includes(item.description.toLowerCase().substring(0, 20))
              );
              
              let category = aiResult?.category || 'Outros';
              
              // Validate category is in our list
              if (!VALID_CATEGORIES.includes(category as any)) {
                category = 'Outros';
              }
              
              results[item.index] = {
                description: item.description,
                category,
                confidence: 'medium',
                source: 'ai'
              };
            }
          } catch (parseError) {
            console.error("Failed to parse AI response:", parseError, content);
            // Fallback
            for (const item of needsAI) {
              results[item.index] = {
                description: item.description,
                category: 'Outros',
                confidence: 'low',
                source: 'ai'
              };
            }
          }
        }
      }
    }

    // Sort results back to original order
    const sortedResults = results.filter(Boolean);

    return new Response(
      JSON.stringify({ 
        results: sortedResults,
        stats: {
          total: descriptions.length,
          ruleBased: sortedResults.filter(r => r.source === 'rule').length,
          aiCategorized: sortedResults.filter(r => r.source === 'ai').length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("categorize-transactions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
