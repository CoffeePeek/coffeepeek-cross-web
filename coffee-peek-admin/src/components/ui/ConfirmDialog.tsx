import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './AlertDialog';
import { Textarea } from './Textarea';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'success' | 'primary';
  withComment?: boolean;
  commentLabel?: string;
  onConfirm: (comment?: string) => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'primary',
  withComment = false,
  commentLabel = 'Комментарий',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm(withComment ? comment : undefined);
      setComment('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && !loading && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        {withComment && (
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={commentLabel}
            aria-label={commentLabel}
            rows={3}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
              variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
          >
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
