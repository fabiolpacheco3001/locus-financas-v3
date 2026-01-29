import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/useLocale';

export function TrashCleanupButton() {
  const { t } = useLocale();
  const { householdId } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Query to count cancelled transactions
  const { data: cancelledCount = 0 } = useQuery({
    queryKey: ['cancelled-transactions-count', householdId],
    queryFn: async () => {
      if (!householdId) return 0;
      
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .not('cancelled_at', 'is', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!householdId,
  });

  const handleHardDelete = async () => {
    if (!householdId) return;
    
    setIsDeleting(true);
    try {
      // HARD DELETE: Permanently remove all cancelled transactions
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('household_id', householdId)
        .not('cancelled_at', 'is', null);

      if (error) throw error;

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      queryClient.invalidateQueries({ queryKey: ['cancelled-transactions-count'] });

      toast.success(t('trash.deleteSuccess'));
      setShowDialog(false);
    } catch (error) {
      console.error('Error deleting cancelled transactions:', error);
      toast.error(t('trash.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Only show if there are cancelled transactions
  if (cancelledCount === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        {t('trash.emptyTrash')} ({cancelledCount})
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('trash.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('trash.confirmDescription', { count: cancelledCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('trash.deletePermanently')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
