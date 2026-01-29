import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentMethod } from '@/types/creditCards';

interface PredictionResult {
  category_id: string | null;
  subcategory_id: string | null;
  account_id: string | null;
  payment_method: string | null;
  description: string | null;
  member_id: string | null;
  match_count: number;
}

interface UsePredictTransactionProps {
  description: string;
  enabled?: boolean;
  debounceMs?: number;
}

export function usePredictTransaction({
  description,
  enabled = true,
  debounceMs = 300,
}: UsePredictTransactionProps) {
  const { householdId } = useAuth();
  const [debouncedDescription, setDebouncedDescription] = useState(description);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce the description
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedDescription(description);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [description, debounceMs]);

  const { data: prediction, isLoading } = useQuery({
    queryKey: ['predict-transaction', debouncedDescription, householdId],
    queryFn: async () => {
      if (!householdId || !debouncedDescription || debouncedDescription.length < 2) {
        return null;
      }

      const { data, error } = await supabase.rpc('predict_transaction_details', {
        p_description: debouncedDescription,
      });

      if (error) {
        console.error('Prediction error:', error);
        return null;
      }

      return data as unknown as PredictionResult | null;
    },
    enabled: enabled && !!householdId && debouncedDescription.length >= 2,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    gcTime: 1000 * 60 * 5,
  });

  // Extract typed values from prediction
  const predictedValues = prediction ? {
    categoryId: prediction.category_id,
    subcategoryId: prediction.subcategory_id,
    accountId: prediction.account_id,
    paymentMethod: prediction.payment_method as PaymentMethod | null,
    description: prediction.description,
    memberId: prediction.member_id,
    matchCount: prediction.match_count,
  } : null;

  return {
    prediction: predictedValues,
    isLoading,
    hasPrediction: !!predictedValues && predictedValues.matchCount > 0,
  };
}
