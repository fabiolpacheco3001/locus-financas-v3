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
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

export type InstallmentActionType = 'edit' | 'delete';

interface InstallmentActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: InstallmentActionType;
  installmentNumber: number;
  installmentTotal: number;
  onSelectScope: (scope: 'single' | 'this_and_future') => void;
}

export function InstallmentActionDialog({
  open,
  onOpenChange,
  actionType,
  installmentNumber,
  installmentTotal,
  onSelectScope,
}: InstallmentActionDialogProps) {
  const isEdit = actionType === 'edit';
  const actionLabel = isEdit ? 'Editar' : 'Excluir';
  const actionLabelLower = isEdit ? 'editar' : 'excluir';
  
  const remainingCount = installmentTotal - installmentNumber + 1;
  const hasFutureInstallments = installmentNumber < installmentTotal;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle>{actionLabel} parcela {installmentNumber}/{installmentTotal}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta transação faz parte de uma compra parcelada. 
              Como deseja {actionLabelLower}?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 my-4">
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4"
            onClick={() => {
              onSelectScope('single');
              onOpenChange(false);
            }}
          >
            <div className="text-left">
              <div className="font-medium">{actionLabel} apenas esta parcela</div>
              <div className="text-xs text-muted-foreground">
                Parcela {installmentNumber} de {installmentTotal}
              </div>
            </div>
          </Button>
          
          {hasFutureInstallments && (
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4"
              onClick={() => {
                onSelectScope('this_and_future');
                onOpenChange(false);
              }}
            >
              <div className="text-left">
                <div className="font-medium">{actionLabel} esta e as parcelas futuras</div>
                <div className="text-xs text-muted-foreground">
                  {remainingCount} parcela(s) serão {isEdit ? 'alteradas' : 'excluídas'}
                </div>
              </div>
            </Button>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
