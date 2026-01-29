import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Trash2, Search, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';

interface ForensicResult {
  transactions: {
    count: number;
    sum: number;
    items: any[];
  };
  transactionsWithCancelled: {
    count: number;
    sum: number;
    items: any[];
  };
  recurring: {
    count: number;
    sum: number;
    items: any[];
  };
  installments: {
    count: number;
    sum: number;
    items: any[];
  };
  topSuspects: any[];
}

export function ForensicInspector() {
  const { householdId } = useAuth();
  const { formatCurrency } = useLocale();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [nukeTarget, setNukeTarget] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['forensic-inspector', householdId],
    queryFn: async (): Promise<ForensicResult> => {
      if (!householdId) throw new Error('No household');

      // 1. ALL pending/planned expenses (NO FILTERS)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('status', 'planned');
      
      if (txError) throw txError;

      // 2. ALL pending/planned expenses INCLUDING cancelled_at (see if they exist)
      const { data: txWithCancelled, error: txCancelledError } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .in('status', ['planned', 'confirmed'])
        .not('cancelled_at', 'is', null);
      
      if (txCancelledError) throw txCancelledError;

      // 3. Recurring transactions (templates)
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('household_id', householdId);
      
      if (recurringError) throw recurringError;

      // 4. Installment transactions (linked by installment_group_id)
      const { data: installmentData, error: installmentError } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .not('installment_group_id', 'is', null);
      
      if (installmentError) throw installmentError;

      // 5. Top 10 suspects (largest pending expenses)
      const { data: suspects, error: suspectsError } = await supabase
        .from('transactions')
        .select('id, description, amount, date, due_date, status, cancelled_at, installment_number, installment_total, recurring_transaction_id')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('status', 'planned')
        .order('amount', { ascending: false })
        .limit(10);
      
      if (suspectsError) throw suspectsError;

      return {
        transactions: {
          count: txData?.length || 0,
          sum: txData?.reduce((acc, t) => acc + Number(t.amount), 0) || 0,
          items: txData || [],
        },
        transactionsWithCancelled: {
          count: txWithCancelled?.length || 0,
          sum: txWithCancelled?.reduce((acc, t) => acc + Number(t.amount), 0) || 0,
          items: txWithCancelled || [],
        },
        recurring: {
          count: recurringData?.length || 0,
          sum: recurringData?.reduce((acc, t) => acc + Number(t.amount), 0) || 0,
          items: recurringData || [],
        },
        installments: {
          count: installmentData?.length || 0,
          sum: installmentData?.reduce((acc, t) => acc + Number(t.amount), 0) || 0,
          items: installmentData || [],
        },
        topSuspects: suspects || [],
      };
    },
    enabled: !!householdId,
  });

  const handleNuke = async (target: string) => {
    if (!householdId) return;
    
    try {
      if (target === 'pending_transactions') {
        // Delete all planned expenses
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('household_id', householdId)
          .eq('kind', 'EXPENSE')
          .eq('status', 'planned');
        if (error) throw error;
      } else if (target === 'cancelled_transactions') {
        // Delete all transactions with cancelled_at set
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('household_id', householdId)
          .not('cancelled_at', 'is', null);
        if (error) throw error;
      } else if (target === 'recurring_transactions') {
        // Delete all recurring transaction templates
        const { error } = await supabase
          .from('recurring_transactions')
          .delete()
          .eq('household_id', householdId);
        if (error) throw error;
      }

      // Invalidate all queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      queryClient.invalidateQueries({ queryKey: ['forensic-inspector'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });

      toast.success(`Dados eliminados com sucesso!`);
      setNukeTarget(null);
    } catch (error) {
      console.error('Nuke error:', error);
      toast.error('Erro ao eliminar dados');
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      queryClient.invalidateQueries({ queryKey: ['forensic-inspector'] });

      toast.success('Transação eliminada');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro ao eliminar');
    }
  };

  if (!expanded) {
    return (
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(true)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-500" />
              🕵️‍♂️ CSI Financeiro
            </CardTitle>
            <ChevronDown className="h-5 w-5" />
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-500" />
              🕵️‍♂️ CSI Financeiro - Inspetor Forense
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : data ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Pending Transactions */}
                <Card className={data.transactions.sum > 0 ? 'border-red-500 bg-red-500/10' : ''}>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Transações Pendentes (planned)
                    </div>
                    <div className="text-lg font-bold">
                      {data.transactions.count} registros
                    </div>
                    <div className={`text-xl font-mono ${data.transactions.sum > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {formatCurrency(data.transactions.sum)}
                    </div>
                    {data.transactions.sum > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setNukeTarget('pending_transactions')}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        ZERAR
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Cancelled but not deleted */}
                <Card className={data.transactionsWithCancelled.sum > 0 ? 'border-orange-500 bg-orange-500/10' : ''}>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Com cancelled_at (zumbis)
                    </div>
                    <div className="text-lg font-bold">
                      {data.transactionsWithCancelled.count} registros
                    </div>
                    <div className={`text-xl font-mono ${data.transactionsWithCancelled.sum > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                      {formatCurrency(data.transactionsWithCancelled.sum)}
                    </div>
                    {data.transactionsWithCancelled.sum > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setNukeTarget('cancelled_transactions')}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        ZERAR
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Recurring Templates */}
                <Card className={data.recurring.sum > 0 ? 'border-purple-500 bg-purple-500/10' : ''}>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Templates Recorrentes
                    </div>
                    <div className="text-lg font-bold">
                      {data.recurring.count} templates
                    </div>
                    <div className="text-xl font-mono text-purple-500">
                      {formatCurrency(data.recurring.sum)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      (Não deve somar no saldo)
                    </div>
                  </CardContent>
                </Card>

                {/* Installments */}
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Parcelas (installments)
                    </div>
                    <div className="text-lg font-bold">
                      {data.installments.count} parcelas
                    </div>
                    <div className="text-xl font-mono">
                      {formatCurrency(data.installments.sum)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Suspects Table */}
              {data.topSuspects.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Top 10 Suspeitos (Maiores Despesas Pendentes)
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">ID</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Flags</TableHead>
                          <TableHead className="w-[80px]">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topSuspects.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">
                              {item.id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>{item.description || '(sem descrição)'}</TableCell>
                            <TableCell className="font-mono font-bold text-red-500">
                              {formatCurrency(Number(item.amount))}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.date || 'NULL'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.due_date || 'NULL'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.cancelled_at && (
                                  <Badge variant="destructive" className="text-xs">
                                    CANCELADO
                                  </Badge>
                                )}
                                {item.recurring_transaction_id && (
                                  <Badge variant="secondary" className="text-xs">
                                    RECORRENTE
                                  </Badge>
                                )}
                                {item.installment_number && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.installment_number}/{item.installment_total}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => handleDeleteSingle(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* All clear message */}
              {data.transactions.count === 0 && data.transactionsWithCancelled.count === 0 && (
                <div className="text-center py-4 text-green-500">
                  ✅ Nenhuma transação fantasma encontrada!
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Nuke Confirmation Dialog */}
      <AlertDialog open={!!nukeTarget} onOpenChange={() => setNukeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ATENÇÃO: Exclusão em Massa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>DELETAR PERMANENTEMENTE</strong> todos os registros desta categoria.
              Esta ação NÃO pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => nukeTarget && handleNuke(nukeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              DELETAR TUDO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
