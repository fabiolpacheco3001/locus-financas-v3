/**
 * Smart Categorizer - Hybrid AI Categorization Engine
 * 
 * Level 1: Fast local keyword matching (instant, no network)
 * Level 2: Edge Function AI fallback when Level 1 returns low confidence
 * 
 * This is a client-side engine that uses a database of 150+ keywords
 * to automatically assign categories to transactions.
 */

export interface CategoryMatch {
  categoryName: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeyword: string;
  source: 'local' | 'ai';
}

export interface AICategoryResult {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'rule' | 'ai';
}

// Keyword patterns mapped to category names (Portuguese focus)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Food & Dining
  'Alimentação': [
    'ifood', 'uber eats', 'rappi', 'mercado', 'supermercado', 'padaria', 'restaurante',
    'lanchonete', 'pizzaria', 'açougue', 'hortifruti', 'atacadão', 'assaí', 'carrefour',
    'extra', 'pão de açúcar', 'dia', 'oba', 'natural da terra', 'mc donalds', 'burger king',
    'subway', 'habib', 'giraffas', 'outback', 'starbucks', 'coffee', 'café', 'sushi',
    'churrascaria', 'bar ', 'boteco', 'food', 'delivery'
  ],
  
  // Transportation
  'Transporte': [
    'uber', '99', 'cabify', 'taxi', 'táxi', 'lyft', 'posto', 'combustível', 'gasolina',
    'etanol', 'diesel', 'shell', 'ipiranga', 'br distribuidora', 'petrobras', 'estacionamento',
    'zona azul', 'pedágio', 'sem parar', 'conectcar', 'move mais', 'metro', 'metrô',
    'onibus', 'ônibus', 'brt', 'integração', 'bilhete único', 'passagem', 'cptm'
  ],
  
  // Subscriptions & Streaming
  'Assinaturas': [
    'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'max', 'globoplay', 'paramount',
    'apple music', 'youtube premium', 'twitch', 'deezer', 'tidal', 'audible', 'kindle',
    'playstation', 'xbox game pass', 'nintendo', 'steam', 'epic games', 'adobe',
    'microsoft 365', 'office', 'dropbox', 'google one', 'icloud', 'canva', 'figma'
  ],
  
  // Health & Wellness
  'Saúde': [
    'farmácia', 'farmacia', 'drogaria', 'droga raia', 'drogasil', 'pacheco', 'pague menos',
    'ultrafarma', 'hospital', 'clínica', 'clinica', 'médico', 'medico', 'dentista',
    'laboratório', 'laboratorio', 'exame', 'consulta', 'unimed', 'bradesco saúde',
    'sulamérica', 'amil', 'hapvida', 'notre dame', 'psicólogo', 'psicologo', 'terapia',
    'academia', 'gym', 'smart fit', 'bluefit', 'bio ritmo', 'crossfit', 'pilates', 'yoga'
  ],
  
  // Shopping & Retail
  'Compras': [
    'shopping', 'magazine luiza', 'magalu', 'americanas', 'shopee', 'mercado livre',
    'amazon', 'aliexpress', 'shein', 'renner', 'riachuelo', 'c&a', 'zara', 'h&m',
    'centauro', 'netshoes', 'decathlon', 'leroy merlin', 'telhanorte', 'tok stok',
    'etna', 'camicado', 'fast shop', 'casas bahia', 'ponto', 'kabum', 'terabyte'
  ],
  
  // Utilities & Bills
  'Contas': [
    'enel', 'eletropaulo', 'cemig', 'copel', 'celesc', 'light', 'cpfl', 'elektro',
    'sabesp', 'copasa', 'caesb', 'corsan', 'compesa', 'embasa', 'cagece', 'cedae',
    'comgas', 'naturgy', 'claro', 'vivo', 'tim', 'oi', 'net', 'algar', 'internet',
    'telefone', 'celular', 'condomínio', 'condominio', 'iptu', 'ipva', 'seguro', 'aluguel'
  ],
  
  // Education
  'Educação': [
    'escola', 'faculdade', 'universidade', 'curso', 'alura', 'udemy', 'coursera',
    'rocketseat', 'origamid', 'duolingo', 'babbel', 'wizard', 'ccaa', 'fisk', 'cultura inglesa',
    'livraria', 'saraiva', 'cultura', 'amazon livros', 'estante virtual', 'mensalidade'
  ],
  
  // Entertainment
  'Lazer': [
    'cinema', 'cinemark', 'uci', 'kinoplex', 'ingresso', 'teatro', 'show', 'festival',
    'parque', 'viagem', 'hotel', 'airbnb', 'booking', 'decolar', 'cvc', 'latam', 'gol',
    'azul', 'passagem aérea', 'aluguel carro', 'localiza', 'movida', 'unidas', 'jogo',
    'game', 'hobby', 'esporte', 'clube', 'academia'
  ],
  
  // Personal Care
  'Beleza': [
    'salão', 'salao', 'cabelereiro', 'barbearia', 'manicure', 'pedicure', 'spa',
    'estética', 'estetica', 'o boticário', 'natura', 'avon', 'sephora', 'mac',
    'perfumaria', 'perfume', 'cosmético', 'cosmetico', 'maquiagem'
  ],
  
  // Home & Family
  'Casa': [
    'móveis', 'moveis', 'eletrodoméstico', 'eletrodomestico', 'decoração', 'decoracao',
    'limpeza', 'manutenção', 'manutencao', 'reforma', 'construção', 'construcao',
    'material de construção', 'ferramenta', 'jardim', 'pet', 'veterinário', 'veterinario',
    'petz', 'cobasi', 'ração', 'racao'
  ],
  
  // Income patterns
  'Salário': [
    'salário', 'salario', 'folha de pagamento', 'pagamento mensal', 'remuneração',
    'remuneracao', 'pró-labore', 'pro-labore', 'ordenado'
  ],
  
  // Transfers
  'Transferência': [
    'pix recebido', 'pix enviado', 'ted', 'doc', 'transferência', 'transferencia',
    'depósito', 'deposito'
  ]
};

// Additional high-confidence exact matches
const EXACT_MATCHES: Record<string, string> = {
  'netflix': 'Assinaturas',
  'spotify': 'Assinaturas',
  'uber': 'Transporte',
  '99': 'Transporte',
  'ifood': 'Alimentação',
  'rappi': 'Alimentação',
  'mercado livre': 'Compras',
  'amazon': 'Compras',
  'smart fit': 'Saúde',
};

/**
 * Level 1: Local keyword-based categorization (instant, no network)
 */
export function categorizeDescriptionLocal(description: string): CategoryMatch | null {
  if (!description || description.length < 2) return null;
  
  const normalizedDesc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Check exact matches first (high confidence)
  for (const [keyword, category] of Object.entries(EXACT_MATCHES)) {
    if (normalizedDesc.includes(keyword)) {
      return {
        categoryName: category,
        confidence: 'high',
        matchedKeyword: keyword,
        source: 'local'
      };
    }
  }
  
  // Check keyword patterns
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedDesc.includes(normalizedKeyword)) {
        const confidence = keyword.length >= 6 ? 'high' : keyword.length >= 4 ? 'medium' : 'low';
        return {
          categoryName: category,
          confidence,
          matchedKeyword: keyword,
          source: 'local'
        };
      }
    }
  }
  
  return null;
}

/**
 * Legacy sync function - maintains backward compatibility
 * @deprecated Use categorizeDescriptionHybrid for better results
 */
export function categorizeDescription(description: string): CategoryMatch | null {
  return categorizeDescriptionLocal(description);
}

/**
 * Level 2: Call Edge Function for AI-powered categorization
 */
async function categorizeWithAI(descriptions: string[]): Promise<Map<string, AICategoryResult>> {
  const results = new Map<string, AICategoryResult>();
  
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      console.warn('[SmartCategorizer] VITE_SUPABASE_URL not configured');
      return results;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/categorize-transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ descriptions }),
    });
    
    if (!response.ok) {
      console.warn('[SmartCategorizer] AI categorization failed:', response.status);
      return results;
    }
    
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((r: { description: string; category: string; confidence: string; source: string }) => {
        results.set(r.description, {
          category: r.category,
          confidence: r.confidence as 'high' | 'medium' | 'low',
          source: r.source as 'rule' | 'ai',
        });
      });
    }
    
    return results;
  } catch (error) {
    console.warn('[SmartCategorizer] AI categorization error:', error);
    return results;
  }
}

/**
 * Hybrid categorization: Level 1 (local) + Level 2 (AI fallback)
 * Use this for single descriptions when you need the best possible match
 */
export async function categorizeDescriptionHybrid(description: string): Promise<CategoryMatch | null> {
  // Level 1: Try local first (instant)
  const localMatch = categorizeDescriptionLocal(description);
  
  // If local match is high confidence, use it
  if (localMatch && localMatch.confidence === 'high') {
    return localMatch;
  }
  
  // Level 2: Call AI for uncertain cases
  try {
    const aiResults = await categorizeWithAI([description]);
    const aiResult = aiResults.get(description);
    
    if (aiResult && aiResult.category !== 'Outros') {
      return {
        categoryName: aiResult.category,
        confidence: aiResult.confidence,
        matchedKeyword: 'ai',
        source: 'ai'
      };
    }
  } catch {
    // Fallback to local match if AI fails
  }
  
  // Return local match (even if low confidence) or null
  return localMatch;
}

/**
 * Batch hybrid categorization - efficient for multiple descriptions
 */
export async function categorizeDescriptionsBatch(
  descriptions: string[]
): Promise<Map<string, CategoryMatch | null>> {
  const results = new Map<string, CategoryMatch | null>();
  const needsAI: string[] = [];
  
  // Level 1: Process all locally first
  for (const desc of descriptions) {
    const localMatch = categorizeDescriptionLocal(desc);
    
    if (localMatch && localMatch.confidence === 'high') {
      results.set(desc, localMatch);
    } else {
      results.set(desc, localMatch); // Store local result as fallback
      needsAI.push(desc);
    }
  }
  
  // Level 2: Batch AI call for uncertain ones
  if (needsAI.length > 0) {
    try {
      const aiResults = await categorizeWithAI(needsAI);
      
      for (const desc of needsAI) {
        const aiResult = aiResults.get(desc);
        if (aiResult && aiResult.category !== 'Outros') {
          results.set(desc, {
            categoryName: aiResult.category,
            confidence: aiResult.confidence,
            matchedKeyword: 'ai',
            source: 'ai'
          });
        }
        // Otherwise keep the local fallback already stored
      }
    } catch {
      // Keep local fallbacks on AI failure
    }
  }
  
  return results;
}

/**
 * Batch categorize multiple descriptions (legacy sync version)
 * @deprecated Use categorizeDescriptionsBatch for better results
 */
export function categorizeTransactions<T extends { description: string }>(
  transactions: T[],
  categories: Array<{ id: string; name: string }>
): Array<{ transaction: T; match: CategoryMatch | null; categoryId: string | null }> {
  return transactions.map(transaction => {
    const match = categorizeDescriptionLocal(transaction.description);
    
    // Try to find matching category by name
    let categoryId: string | null = null;
    if (match) {
      const foundCategory = categories.find(
        c => c.name.toLowerCase() === match.categoryName.toLowerCase() ||
             c.name.toLowerCase().includes(match.categoryName.toLowerCase()) ||
             match.categoryName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (foundCategory) {
        categoryId = foundCategory.id;
      }
    }
    
    return { transaction, match, categoryId };
  });
}

/**
 * Async batch categorize with AI fallback
 */
export async function categorizeTransactionsHybrid<T extends { description: string }>(
  transactions: T[],
  categories: Array<{ id: string; name: string }>
): Promise<Array<{ transaction: T; match: CategoryMatch | null; categoryId: string | null }>> {
  const descriptions = transactions.map(t => t.description).filter(Boolean);
  const matchMap = await categorizeDescriptionsBatch(descriptions);
  
  return transactions.map(transaction => {
    const match = matchMap.get(transaction.description) || null;
    
    let categoryId: string | null = null;
    if (match) {
      const foundCategory = categories.find(
        c => c.name.toLowerCase() === match.categoryName.toLowerCase() ||
             c.name.toLowerCase().includes(match.categoryName.toLowerCase()) ||
             match.categoryName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (foundCategory) {
        categoryId = foundCategory.id;
      }
    }
    
    return { transaction, match, categoryId };
  });
}
