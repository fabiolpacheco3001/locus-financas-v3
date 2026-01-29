import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMembers } from '@/hooks/useMembers';
import { useLocale } from '@/i18n/useLocale';
import { MemberRole } from '@/types/finance';
import { Plus, Pencil, Trash2, Users, User, Shield, Loader2, UserPlus } from 'lucide-react';
import { safeSelectValue } from '@/lib/utils';
import { InviteDialog } from '@/components/members/InviteDialog';

export default function MembersPage() {
  const { user, loading: authLoading, member: currentMember } = useAuth();
  const { members, isLoading, createMember, updateMember, deleteMember } = useMembers();
  const { t } = useLocale();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<MemberRole>('MEMBER');

  const isAdmin = currentMember?.role === 'ADMIN';

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormRole('MEMBER');
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (member: typeof members[0]) => {
    setEditingId(member.id);
    setFormName(member.name);
    setFormRole(member.role);
    setIsDialogOpen(true);
  };

  const adminCount = members.filter(m => m.role === 'ADMIN').length;

  const isLastAdmin = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member?.role === 'ADMIN' && adminCount === 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if trying to demote the last admin
    if (editingId && isLastAdmin(editingId) && formRole !== 'ADMIN') {
      alert(t('members.messages.cannotDemoteLastAdmin'));
      return;
    }

    const data = {
      name: formName,
      role: formRole,
    };

    try {
      if (editingId) {
        await updateMember.mutateAsync({ id: editingId, ...data });
      } else {
        await createMember.mutateAsync(data);
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentMember?.id) {
      alert(t('members.messages.cannotRemoveSelf'));
      return;
    }
    
    // Check if trying to delete the last admin
    if (isLastAdmin(id)) {
      alert(t('members.messages.cannotRemoveLastAdmin'));
      return;
    }
    
    if (confirm(t('members.messages.deleteConfirm'))) {
      try {
        await deleteMember.mutateAsync(id);
      } catch {
        // Error already handled by mutation's onError
      }
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title={t('members.title')}
        description={t('members.description')}
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('invites.invite')}
              </Button>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {t('members.new')}
              </Button>
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('members.empty.title')}
          description={t('members.empty.description')}
          actionLabel={isAdmin ? t('members.new') : undefined}
          onAction={isAdmin ? openNewDialog : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(member => (
            <Card key={member.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      {member.role === 'ADMIN' ? (
                        <Shield className="h-6 w-6 text-primary" />
                      ) : (
                        <User className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      {member.email && (
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                      <Badge 
                        variant="secondary" 
                        className={`mt-1 ${
                          member.role === 'ADMIN' 
                            ? 'bg-primary/10 text-primary' 
                            : ''
                        }`}
                      >
                        {t(`members.roles.${member.role}`)}
                      </Badge>
                    </div>
                  </div>
                  
                  {isAdmin && member.id !== currentMember?.id && (
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(member)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(member.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Member Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('members.edit') : t('members.new')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('members.name')}</Label>
              <Input
                placeholder={t('members.namePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>


            <div className="space-y-2">
              <Label>{t('members.role')}</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">{t('members.roles.MEMBER')}</SelectItem>
                  <SelectItem value="ADMIN">{t('members.roles.ADMIN')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMember.isPending || updateMember.isPending}>
                {(createMember.isPending || updateMember.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingId ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <InviteDialog 
        open={isInviteDialogOpen} 
        onOpenChange={setIsInviteDialogOpen} 
      />
    </AppLayout>
  );
}